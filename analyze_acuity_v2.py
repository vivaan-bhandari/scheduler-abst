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

def analyze_with_thresholds(csv_file, high_threshold):
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
                total_care_time = float(row['ResidentTotalCareTime']) if row['ResidentTotalCareTime'] else 0
            except (ValueError, KeyError):
                frequency = 0
                time_per_task = 0
                total_task_time = 0
                total_care_time = 0
            
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
    
    high = []
    medium = []
    low = []
    independent = []
    no_data = []
    
    for name, data in residents.items():
        score = data['weighted_score']
        hours = data['total_weekly_hours']
        adl_count = data['adl_count']
        
        if adl_count == 0:
            no_data.append(name)
        elif score >= high_threshold or hours >= 6:
            high.append((name, score, hours))
        elif (score >= 3 and score < high_threshold) or (score >= 1 and hours >= 4 and hours < 6):
            medium.append((name, score, hours))
        elif score >= 1 and score < 3 and hours < 4:
            low.append((name, score, hours))
        else:
            independent.append((name, score, hours))
    
    return {
        'high': len(high),
        'medium': len(medium),
        'low': len(low),
        'independent': len(independent),
        'no_data': len(no_data),
        'total': len(residents)
    }

if __name__ == '__main__':
    csv_file = 'Mill View Memory Care (50R455) - Answer Export 12-01-2025.csv'
    
    print(f"\n{'='*70}")
    print(f"ACUITY DISTRIBUTION WITH DIFFERENT THRESHOLDS")
    print(f"{'='*70}\n")
    
    print(f"{'High Threshold':<20} | {'High':<6} | {'Medium':<6} | {'Low':<6} | {'Independent':<12} | {'No Data':<8}")
    print(f"{'-'*70}")
    
    for threshold in [5, 6, 7, 8, 9, 10]:
        result = analyze_with_thresholds(csv_file, threshold)
        print(f"Score ≥ {threshold:2d} OR ≥6h    | {result['high']:6d} | {result['medium']:6d} | {result['low']:6d} | {result['independent']:12d} | {result['no_data']:8d}")
    
    print(f"\n{'='*70}")
    print("RECOMMENDATION:")
    print(f"{'='*70}")
    print("Based on the data, all residents have scores ≥ 5.")
    print("For a realistic distribution, consider:")
    print("  - High Acuity: Score ≥ 8 OR Time ≥ 6h")
    print("  - Medium Acuity: Score 5-7 OR (Score 3-4 AND Time 4-6h)")
    print("  - Low Acuity: Score 1-4 AND Time < 4h")
    print("\nThis would give you:")
    result = analyze_with_thresholds(csv_file, 8)
    print(f"  High: {result['high']}, Medium: {result['medium']}, Low: {result['low']}, Independent: {result['independent']}")

