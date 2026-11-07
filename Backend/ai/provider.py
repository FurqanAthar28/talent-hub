"""
The single backend file that talks to the AI.

The AI is a free open model that runs on OUR OWN machine with Ollama
(see settings.AI_BASE_URL), so nothing is sent to an AI company.
Ollama speaks the same API as OpenAI, so we reuse the `openai` package
as the client: no extra package needed.

Profile facts are sent without email, private notes, CVs, or other users' data.
Failures become one safe "AI is unavailable" message for the page.
"""

import json
import logging

import openai
from django.conf import settings

logger = logging.getLogger(__name__)

HEADLINE_MAX_LENGTH = 255

# Small models are slow on a normal CPU, so we cap the answer length.
# Without a cap one rambling answer could run past the proxy's 30 seconds.
HEADLINE_BIO_MAX_TOKENS = 500
JOB_DRAFT_MAX_TOKENS = 600

# Must match the job form's limits (Backend/jobs/models.py).
JOB_TITLE_MIN_LENGTH = 3
JOB_DESCRIPTION_MIN_LENGTH = 30
SKILL_MAX_LENGTH = 60  # LIST_ITEM_MAX_LENGTH in Frontend/app/config/constants.ts

HEADLINE_BIO_SYSTEM_PROMPT = """You write profile text for a professional network.
Use only facts in the JSON. Never invent employers, degrees, years, achievements,
skills, or other facts. Return JSON only with exactly these keys:
headlines, short_bio, long_bio.
headlines must contain exactly 3 different plain-text headlines under 120 characters.
short_bio must be 1-2 sentences under 200 characters.
long_bio must be 3-5 sentences under 700 characters.
If the profile is thin, write a short, honest summary rather than inventing facts.
"""

JOB_DRAFT_SYSTEM_PROMPT = """You help a recruiter write a job post.
The JSON has the recruiter's rough notes and the job details they picked.
Use only facts in the JSON. Never invent the company name, salary, benefits,
years of experience, or anything else the notes don't say.
Return JSON only with exactly these keys: title, description, skills.
title: a clear job title under 80 characters.
description: plain text under 1200 characters, in short paragraphs:
what the person will do, what they need, and what is offered (only if the notes say).
skills: a list of up to 8 short skill names that the notes mention.
"""


class AIUnavailable(Exception):
    """The AI could not give a usable answer."""


def is_configured():
    return bool(settings.AI_BASE_URL)


def _ask_for_json(system_prompt, user_text, max_tokens):
    """Ask the AI for JSON and reject answers that are not usable."""
    client = openai.OpenAI(
        base_url=settings.AI_BASE_URL,
        # Ollama ignores the key, but the client needs some text here.
        api_key="local",
        timeout=settings.AI_TIMEOUT_SECONDS,
        max_retries=0,
    )

    try:
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
    except openai.APIStatusError as error:
        # For example 404 when the model hasn't been downloaded ("ollama pull").
        logger.error("The AI returned HTTP %s", error.status_code)
        raise AIUnavailable from error
    except openai.APIConnectionError as error:
        # Ollama isn't running, or it took longer than AI_TIMEOUT_SECONDS.
        logger.warning("Couldn't reach the AI: %s", type(error).__name__)
        raise AIUnavailable from error

    text = response.choices[0].message.content if response.choices else ""
    try:
        return json.loads(text or "")
    except json.JSONDecodeError as error:
        logger.error("AI answer was not valid JSON")
        raise AIUnavailable from error


def _clean(value):
    return value.strip() if isinstance(value, str) else ""


def write_headline_and_bios(profile_facts):
    """
    Returns {"headlines": [up to 3 texts], "bios": {"short": text, "long": text}}.
    Raises AIUnavailable if the AI can't give a usable answer.
    """
    try:
        answer = _ask_for_json(
            HEADLINE_BIO_SYSTEM_PROMPT,
            json.dumps(profile_facts, ensure_ascii=False),
            HEADLINE_BIO_MAX_TOKENS,
        )
        headlines = [_clean(headline) for headline in answer["headlines"]]
        short_bio = _clean(answer["short_bio"])
        long_bio = _clean(answer["long_bio"])
    except (KeyError, TypeError):
        logger.warning("AI answer was missing a headline or a bio")
        raise AIUnavailable

    # The prompt asks for short texts, but a model can ignore that, so we check.
    headlines = [headline for headline in headlines if 0 < len(headline) <= HEADLINE_MAX_LENGTH][:3]

    if not headlines or not short_bio or not long_bio:
        logger.warning("AI answer was missing a headline or a bio")
        raise AIUnavailable

    return {"headlines": headlines, "bios": {"short": short_bio, "long": long_bio}}


def write_job_draft(job_facts, title_max_length, description_max_length, max_skills):
    """
    Returns {"title": text, "description": text, "skills": [texts]}.
    The limits come from the Job model, so the draft always fits the form.
    Raises AIUnavailable if the AI can't give a usable answer.
    """
    try:
        answer = _ask_for_json(
            JOB_DRAFT_SYSTEM_PROMPT,
            json.dumps(job_facts, ensure_ascii=False),
            JOB_DRAFT_MAX_TOKENS,
        )
        title = " ".join(_clean(answer["title"]).split())
        description = _clean(answer["description"])
        raw_skills = answer.get("skills") or []
        if not isinstance(raw_skills, list):
            raw_skills = []
    except (KeyError, TypeError, AttributeError):
        logger.warning("AI answer was missing the job title or description")
        raise AIUnavailable

    if not JOB_TITLE_MIN_LENGTH <= len(title) <= title_max_length:
        logger.warning("AI job title was empty or too long")
        raise AIUnavailable
    if not JOB_DESCRIPTION_MIN_LENGTH <= len(description) <= description_max_length:
        logger.warning("AI job description was too short or too long")
        raise AIUnavailable

    # Keep only short, different skill names ("django" and "Django" count once).
    skills = []
    seen = set()
    for skill in raw_skills:
        name = " ".join(_clean(skill).split())
        if name and len(name) <= SKILL_MAX_LENGTH and name.lower() not in seen:
            seen.add(name.lower())
            skills.append(name)

    return {"title": title, "description": description, "skills": skills[:max_skills]}
