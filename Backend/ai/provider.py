"""
The single backend file that talks to OpenAI.

Profile facts are sent without email, private notes, CVs, or other users' data.
Provider failures become one safe message for the profile editor.
"""

import json
import logging

import openai
from django.conf import settings

logger = logging.getLogger(__name__)

HEADLINE_MAX_LENGTH = 255

HEADLINE_BIO_SYSTEM_PROMPT = """You write profile text for a professional network.
Use only facts in the JSON. Never invent employers, degrees, years, achievements,
skills, or other facts. Return JSON only with exactly these keys:
headlines, short_bio, long_bio.
headlines must contain exactly 3 different plain-text headlines under 120 characters.
short_bio must be 1-2 sentences under 200 characters.
long_bio must be 3-5 sentences under 700 characters.
If the profile is thin, write a short, honest summary rather than inventing facts.
"""


class AIUnavailable(Exception):
    """The AI could not give a usable answer."""


def is_configured():
    return bool(settings.OPENAI_API_KEY)


def _ask_for_json(system_prompt, user_text, schema=None):
    """Ask OpenAI for JSON and reject provider responses that are not usable."""
    client = openai.OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
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
        )
    except openai.AuthenticationError as error:
        logger.error("OpenAI rejected the configured API key: %s", type(error).__name__)
        raise AIUnavailable from error
    except openai.RateLimitError as error:
        logger.warning("OpenAI rate limit reached")
        raise AIUnavailable from error
    except openai.APIStatusError as error:
        logger.error("OpenAI returned HTTP %s", error.status_code)
        raise AIUnavailable from error
    except openai.APIConnectionError as error:
        logger.warning("Couldn't reach OpenAI: %s", type(error).__name__)
        raise AIUnavailable from error

    text = response.choices[0].message.content if response.choices else ""
    try:
        return json.loads(text or "")
    except json.JSONDecodeError as error:
        logger.error("OpenAI answer was not valid JSON")
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
        )
        headlines = [_clean(headline) for headline in answer["headlines"]]
        short_bio = _clean(answer["short_bio"])
        long_bio = _clean(answer["long_bio"])
    except (KeyError, TypeError):
        logger.warning("OpenAI answer was missing a headline or a bio")
        raise AIUnavailable

    # The schema fixes the answer's shape but not its lengths, so we check those.
    headlines = [headline for headline in headlines if 0 < len(headline) <= HEADLINE_MAX_LENGTH][:3]

    if not headlines or not short_bio or not long_bio:
        logger.warning("AI answer was missing a headline or a bio")
        raise AIUnavailable

    return {"headlines": headlines, "bios": {"short": short_bio, "long": long_bio}}
