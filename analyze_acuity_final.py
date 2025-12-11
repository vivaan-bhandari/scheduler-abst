import csv

# ADL Weight mapping function (same as frontend)
def get_adl_weight(question_text):
    text = question_text.lower()
    
    if 'bathing' in text:
        return 2
    if 'bowel' in text or 'bladder' in text or 'toileting' in text:
        return 2
    if 'transfer' in text:
        return 2
    if ('behavioral' in text or 'cognitive' in text or 'cueing' in text or
        'redirecting' in text or 'dementia' in text or 'wandering' in text or
        'non-drug interventions for behaviors' in text):
        return 2
    if 'dressing' in text:
        return 1
    if 'grooming' in text or ('hygiene' in text and 'bathing' not in text):
        return 1
    if ('night' in text or 'safety checks' in text or 'fall prevention' in text or
        ('monitoring' in text and ('physical conditions' in text or 'symptoms' in text))):
        return 1
    return 0

def analyze_acuity(csv_file):
    residents = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            resident_name = row['ResidentName'].strip()
            question_text = row['QuestionText']
            
            try:
                frequency = int(row['TotalFrequency']) if row['TotalFrequency'] else 0
                time_per_task = float(row['Time of Task']) if row['Time of Task'] else 0
                total_task_time = float(row['TotalTaskTime']) if row['TotalTaskTime'] else 0
            except (ValueError, KeyError):
                frequency = 0
                time_per_task = 0
                total_task_time = 0
            
            if resident_name not in residents:
                residents[resident_name] = {
                    'weighted_score': 0,
                    'total_weekly_hours': 0,
                    'adl_count': 0
                }
            
            if frequency > 0 or time_per_task > 0:
                residents[resident_name]['adl_count'] += 1
                weight = get_adl_weight(question_text)
                if weight > 0:
                    residents[resident_name]['weighted_score'] += weight
                weekly_minutes = total_task_time if total_task_time > 0 else (frequency * time_per_task)
                residents[resident_name]['total_weekly_hours'] += weekly_minutes / 60.0
    
    # Classify with NEW thresholds (Score ≥ 8 for High)
    high_acuity = []
    medium_acuity = []
    low_acuity = []
    independent = []
    no_data = []
    
    for name, data in residents.items():
        weighted_score = data['weighted_score']
        total_hours = data['total_weekly_hours']
        adl_count = data['adl_count']
        
        if adl_count == 0:
            no_data.append((name, weighted_score, total_hours))
        # High Acuity: (Weighted ADL Score ≥ 8) OR (Total Weekly Time ≥ 6h)
        elif weighted_score >= 8 or total_hours >= 6:
            high_acuity.append((name, weighted_score, total_hours))
        # Medium Acuity: (Weighted ADL Score 5-7) OR (Score 3-4 AND Total Weekly Time 4-6h)
        elif ((weighted_score >= 5 and weighted_score < 8) or 
              (weighted_score >= 3 and weighted_score < 5 and total_hours >= 4 and total_hours < 6)):
            medium_acuity.append((name, weighted_score, total_hours))
        # Low-Acuity Assisted Living: (Weighted ADL Score 1-4) AND (Total Weekly Time < 4h)
        elif weighted_score >= 1 and weighted_score < 5 and total_hours < 4:
            low_acuity.append((name, weighted_score, total_hours))
        # Independent: weighted score 0 or very minimal care
        else:
            independent.append((name, weighted_score, total_hours))
    
    # Print results
    print(f"\n{'='*70}")
    print(f"EXPECTED ACUITY DISTRIBUTION (with Score ≥ 8 threshold)")
    print(f"{'='*70}\n")
    
    total = len(residents)
    print(f"Total Residents: {total}\n")
    
    print(f"High Acuity (Score ≥8 OR Time ≥6h):")
    print(f"  Count: {len(high_acuity)} ({len(high_acuity)/total*100:.1f}%)")
    for name, score, hours in sorted(high_acuity, key=lambda x: x[1], reverse=True):
        print(f"    {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\nMedium Acuity (Score 5-7 OR Score 3-4 with 4-6h):")
    print(f"  Count: {len(medium_acuity)} ({len(medium_acuity)/total*100:.1f}%)")
    for name, score, hours in sorted(medium_acuity, key=lambda x: x[1], reverse=True):
        print(f"    {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\nLow Acuity (Score 1-4 AND Time <4h):")
    print(f"  Count: {len(low_acuity)} ({len(low_acuity)/total*100:.1f}%)")
    for name, score, hours in sorted(low_acuity, key=lambda x: x[1], reverse=True):
        print(f"    {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\nIndependent (Score 0 or minimal):")
    print(f"  Count: {len(independent)} ({len(independent)/total*100:.1f}%)")
    for name, score, hours in sorted(independent, key=lambda x: x[1], reverse=True):
        print(f"    {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    if no_data:
        print(f"\nNo ADL Data:")
        print(f"  Count: {len(no_data)} ({len(no_data)/total*100:.1f}%)")
        for name, score, hours in no_data:
            print(f"    {name}")
    
    print(f"\n{'='*70}")
    print(f"SUMMARY")
    print(f"{'='*70}")
    print(f"High Acuity:     {len(high_acuity):2d} residents ({len(high_acuity)/total*100:5.1f}%)")
    print(f"Medium Acuity:   {len(medium_acuity):2d} residents ({len(medium_acuity)/total*100:5.1f}%)")
    print(f"Low Acuity:      {len(low_acuity):2d} residents ({len(low_acuity)/total*100:5.1f}%)")
    print(f"Independent:     {len(independent):2d} residents ({len(independent)/total*100:5.1f}%)")
    print(f"No ADL Data:     {len(no_data):2d} residents ({len(no_data)/total*100:5.1f}%)")

if __name__ == '__main__':
    csv_file = 'Mill View Memory Care (50R455) - Answer Export 12-01-2025.csv'
    analyze_acuity(csv_file)

