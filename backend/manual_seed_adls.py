#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'abst.settings')
django.setup()

from adls.models import ADLQuestion

ADL_QUESTIONS = [
    "How much time is spent on personal hygiene such as shaving and mouth care?",
    "How much time is spent on safety checks, fall prevention?",
    "How much time is spent responding to call lights?",
    "How much time is spent assisting with communication, assistive devices for hearing, vision, speech?",
    "How much time is spent monitoring behavioral conditions or symptoms?",
    "How much time is spent monitoring physical conditions or symptoms?",
    "How much time is spent assisting with leisure activities?",
    "How much time is spent ensuring non-drug interventions for behaviors?",
    "How much time is spent cueing or redirecting due to cognitive impairment or dementia?",
    "How much time is spent providing treatments? (e.g. skin care, wound care, antibiotic treatment)",
    "How much time is spent providing non-drug interventions for pain management?",
    "How much time is spent with medication administration, passing out medications?",
    "How much time is spent supervising, cueing, or supporting while eating?",
    "How much time is spent on ambulation, escorting to and from meals or activities?",
    "How much time is spent repositioning in bed or chair?",
    "How much time is spent transferring in or out of bed or a chair?",
    "How much time is spent with bathing?",
    "How much time is spent helping with bowel and bladder management?",
    "How much time is spent on dressing and undressing?",
    "How much time is spent on grooming, such as nail care and brushing hair?",
    "How much time is spent completing resident specific housekeeping or laundry services performed by care staff?",
    "How much time is spent providing additional care services, such as smoking assistance or pet care?",
]

def seed_adl_questions():
    print("Starting ADL questions seeding...")
    count = 0
    for order, text in enumerate(ADL_QUESTIONS, start=1):
        obj, created = ADLQuestion.objects.get_or_create(text=text, defaults={'order': order})
        if created:
            count += 1
            print(f"Created: {text[:50]}...")
        else:
            print(f"Already exists: {text[:50]}...")
    
    print(f"\nSeeding complete! Created {count} new questions out of {len(ADL_QUESTIONS)} total.")
    
    # Verify the count
    total_questions = ADLQuestion.objects.count()
    print(f"Total ADL questions in database: {total_questions}")

if __name__ == '__main__':
    seed_adl_questions() 