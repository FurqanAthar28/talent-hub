"""
The single backend file that talks to the AI.

The AI is a free open model that runs on OUR OWN machine with llama.cpp
(see settings.AI_BASE_URL), so nothing is sent to an AI company.
llama.cpp (and Ollama) speak the same API as OpenAI, so we reuse the
`openai` package as the client: no extra package needed.

Profile facts are sent without email, private notes, CVs, or other users' data.
Failures become one safe "AI is unavailable" message for the page.
"""

import json
import logging
import re

import openai
from django.conf import settings

logger = logging.getLogger(__name__)

HEADLINE_MAX_LENGTH = 255

# Small models are slow on a normal CPU, so we cap the answer length.
# Without a cap one rambling answer could run past the proxy's 30 seconds.
HEADLINE_BIO_MAX_TOKENS = 500
JOB_DRAFT_MAX_TOKENS = 600

# Low = the model sticks to the facts it was given instead of getting creative.
# Small models invent things easily, so this matters more than with big ones.
AI_TEMPERATURE = 0.2
# "New suggestions": a little more variety, or the new answer would be
# almost the same as the last one. Higher than this and the 3B model starts
# making up years and dates. The checks below still apply.
AI_FRESH_TEMPERATURE = 0.4

# Must match the job form's limits (Backend/jobs/models.py).
JOB_TITLE_MIN_LENGTH = 3
JOB_DESCRIPTION_MIN_LENGTH = 30
SKILL_MAX_LENGTH = 60  # LIST_ITEM_MAX_LENGTH in Frontend/app/config/constants.ts

HEADLINE_BIO_SYSTEM_PROMPT = """You write profile text for a professional network.
Rules:
1. Use only facts in the JSON. Never invent employers, degrees, years, achievements,
   skills, projects, or plans.
2. Never claim results or impact (like "improved performance" or "large datasets").
3. Never call the person an expert, specialist, or guru.
4. A short, honest text is better than a long one with made-up details.
5. If "experience" is empty, don't mention years, employers, projects or teams.
6. Say the person is looking for work only if "open_to_work" is true.
7. Write the bios in first person ("I build..."), never "this developer".
Return JSON only with exactly these keys:
headlines, short_bio, long_bio.
headlines must contain exactly 3 different plain-text headlines under 120 characters.
short_bio must be 1-2 sentences under 200 characters.
long_bio must be 2-4 sentences under 700 characters: fewer when the facts are few.
"""

# Words that oversell someone. Small models add them even when told not to,
# so headlines using them are dropped unless the profile itself says so.
BOASTFUL_WORDS = ("expert", "specialist", "guru", "ninja", "rockstar", "wizard", "master")

JOB_DRAFT_SYSTEM_PROMPT = """You help a recruiter write a job post from their rough notes.
Rules:
1. Use only facts in the JSON. Never invent the company name, salary, benefits or duties.
2. Copy requirements exactly. "3+ years" stays "3+ years": never "preferred" or "not required".
3. Plain, simple sentences. No hype words like "cutting-edge" or "rockstar".
Return JSON only with exactly these keys: title, description, skills.
title: a clear job title under 80 characters.
description: plain text under 1200 characters, in 2 or 3 short paragraphs
separated by a blank line: what the person will do, what they need, and what is
offered (only if the notes say).
skills: the skill and tool names written in the notes, nothing else.
"""


class AIUnavailable(Exception):
    """The AI could not give a usable answer."""


def is_configured():
    return bool(settings.AI_BASE_URL)


def _ask_for_json(system_prompt, user_text, max_tokens, fresh=False):
    """Ask the AI for JSON and reject answers that are not usable."""
    client = openai.OpenAI(
        base_url=settings.AI_BASE_URL,
        # Our local AI ignores the key, but the client needs some text here.
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
            temperature=AI_FRESH_TEMPERATURE if fresh else AI_TEMPERATURE,
        )
    except openai.APIStatusError as error:
        # For example when the model isn't loaded yet.
        logger.error("The AI returned HTTP %s", error.status_code)
        raise AIUnavailable from error
    except openai.APIConnectionError as error:
        # The local AI isn't running, or it took longer than AI_TIMEOUT_SECONDS.
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


def _oversells(text, profile_text):
    """True if `text` uses a boastful word that the person's own profile doesn't use."""
    lowered = text.lower()
    return any(word in lowered and word not in profile_text for word in BOASTFUL_WORDS)


def _without_made_up_numbers(text, known_numbers):
    """
    Drop each sentence with a number the profile doesn't have, like "5 years"
    or "since 2015". Small models invent these on thin profiles, and a wrong
    number is the worst kind of made-up detail.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept = [sentence for sentence in sentences if set(re.findall(r"\d+", sentence)) <= known_numbers]
    return " ".join(kept).strip()


# Phrases that say someone wants a job. Dropped when the profile says
# they're NOT open to work, because the model ignores that rule sometimes.
JOB_SEEKING_WORDS = ("looking for", "seeking", "open to new", "opportunit", "available for")


def _without_job_seeking(text):
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept = [sentence for sentence in sentences if not any(word in sentence.lower() for word in JOB_SEEKING_WORDS)]
    return " ".join(kept).strip()


def write_headline_and_bios(profile_facts, fresh=False):
    """
    Returns {"headlines": [up to 3 texts], "bios": {"short": text, "long": text}}.
    Raises AIUnavailable if the AI can't give a usable answer.
    """
    try:
        answer = _ask_for_json(
            HEADLINE_BIO_SYSTEM_PROMPT,
            json.dumps(profile_facts, ensure_ascii=False),
            HEADLINE_BIO_MAX_TOKENS,
            fresh=fresh,
        )
        headlines = [_clean(headline) for headline in answer["headlines"]]
        short_bio = _clean(answer["short_bio"])
        long_bio = _clean(answer["long_bio"])
    except (KeyError, TypeError):
        logger.warning("AI answer was missing a headline or a bio")
        raise AIUnavailable

    # The prompt asks for short, honest texts, but a model can ignore that, so we check.
    profile_text = json.dumps(profile_facts, ensure_ascii=False).lower()
    known_numbers = set(re.findall(r"\d+", profile_text))
    headlines = [
        headline
        for headline in headlines
        if 0 < len(headline) <= HEADLINE_MAX_LENGTH
        and not _oversells(headline, profile_text)
        and _without_made_up_numbers(headline, known_numbers) == headline
    ][:3]
    short_bio = _without_made_up_numbers(short_bio, known_numbers)
    long_bio = _without_made_up_numbers(long_bio, known_numbers)
    if not profile_facts.get("open_to_work"):
        short_bio = _without_job_seeking(short_bio)
        long_bio = _without_job_seeking(long_bio)
    # If every sentence of one bio was dropped, offer the other one instead.
    short_bio, long_bio = short_bio or long_bio, long_bio or short_bio

    if not headlines or not short_bio or not long_bio:
        logger.warning("AI answer was missing a headline or a bio")
        raise AIUnavailable

    return {"headlines": headlines, "bios": {"short": short_bio, "long": long_bio}}


def write_job_draft(job_facts, title_max_length, description_max_length, max_skills, fresh=False):
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
            fresh=fresh,
        )
        title = " ".join(_clean(answer["title"]).split())
        description = _clean(answer["description"])
        raw_skills = answer.get("skills") or []
        # Small models often answer "React, TypeScript" instead of a list.
        if isinstance(raw_skills, str):
            raw_skills = raw_skills.split(",")
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
    # Small models like to add skills nobody asked for ("Agile", "API Testing"),
    # so a skill must also be written in the recruiter's notes.
    notes = str(job_facts.get("notes", "")).lower()
    skills = []
    seen = set()
    for skill in raw_skills:
        name = " ".join(_clean(skill).split())
        in_notes = name.lower() in notes
        if name and in_notes and len(name) <= SKILL_MAX_LENGTH and name.lower() not in seen:
            seen.add(name.lower())
            skills.append(name)

    return {"title": title, "description": description, "skills": skills[:max_skills]}
