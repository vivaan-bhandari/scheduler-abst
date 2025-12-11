import csv
import sys

# ADL Weight mapping function (same as frontend)
def get_adl_weight(question_text):
    text = question_text.lower()
    
    # Bathing: weight 2
    if 'bathing' in text:
        return 2
    
    # Toileting: weight 2 (bowel and bladder management)
    if 'bowel' in text or 'bladder' in text or 'toileting' in text:
        return 2
    
    # Transfers: weight 2
    if 'transfer' in text:
        return 2
    
    # Wandering/Behaviors: weight 2
    if ('behavioral' in text or 'cognitive' in text or 'cueing' in text or
        'redirecting' in text or 'dementia' in text or 'wandering' in text or
        'non-drug interventions for behaviors' in text):
        return 2
    
    # Dressing: weight 1
    if 'dressing' in text:
        return 1
    
    # Grooming: weight 1
    if 'grooming' in text or ('hygiene' in text and 'bathing' not in text):
        return 1
    
    # Night Checks: weight 1
    if ('night' in text or 'safety checks' in text or 'fall prevention' in text or
        ('monitoring' in text and ('physical conditions' in text or 'symptoms' in text))):
        return 1
    
    return 0

# Parse CSV and calculate acuity
def analyze_acuity(csv_file):
    residents = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            resident_name = row['ResidentName'].strip()
            question_text = row['QuestionText']
            
            # Get frequency and time
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
            
            # Initialize resident if not exists
            if resident_name not in residents:
                residents[resident_name] = {
                    'weighted_score': 0,
                    'total_weekly_hours': 0,
                    'adl_count': 0,
                    'total_care_time_minutes': total_care_time
                }
            
            # Only count entries with actual data
            if frequency > 0 or time_per_task > 0:
                residents[resident_name]['adl_count'] += 1
                
                # Calculate weight
                weight = get_adl_weight(question_text)
                if weight > 0:
                    residents[resident_name]['weighted_score'] += weight
                
                # Add to total weekly hours (convert minutes to hours)
                # Use TotalTaskTime if available, otherwise calculate from frequency * time_per_task
                weekly_minutes = total_task_time if total_task_time > 0 else (frequency * time_per_task)
                residents[resident_name]['total_weekly_hours'] += weekly_minutes / 60.0
    
    # Classify residents
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
            no_data.append(name)
        # Try different thresholds to see distribution
        # Option 1: Current thresholds (Score ≥5 OR Time ≥6h)
        elif weighted_score >= 5 or total_hours >= 6:
            high_acuity.append((name, weighted_score, total_hours))
        # Option 2: Adjusted thresholds (Score ≥8 OR Time ≥6h) - uncomment to test
        # elif weighted_score >= 8 or total_hours >= 6:
        #     high_acuity.append((name, weighted_score, total_hours))
        elif (weighted_score >= 3 and weighted_score < 5) or (weighted_score >= 1 and total_hours >= 4 and total_hours < 6):
            medium_acuity.append((name, weighted_score, total_hours))
        elif weighted_score >= 1 and weighted_score < 3 and total_hours < 4:
            low_acuity.append((name, weighted_score, total_hours))
        else:
            independent.append((name, weighted_score, total_hours))
    
    # Print results
    print(f"\n{'='*60}")
    print(f"ACUITY ANALYSIS RESULTS")
    print(f"{'='*60}\n")
    
    print(f"Total Residents: {len(residents)}")
    print(f"\nHigh Acuity (Score ≥5 OR Time ≥6h): {len(high_acuity)}")
    print(f"Medium Acuity (Score 3-4 OR Score 1-4 with 4-6h): {len(medium_acuity)}")
    print(f"Low Acuity (Score 1-2 AND Time <4h): {len(low_acuity)}")
    print(f"Independent (Score 0 or minimal): {len(independent)}")
    print(f"No ADL Data: {len(no_data)}")
    
    print(f"\n{'='*60}")
    print(f"HIGH ACUITY RESIDENTS ({len(high_acuity)}):")
    print(f"{'='*60}")
    for name, score, hours in sorted(high_acuity, key=lambda x: x[1], reverse=True):
        print(f"  {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\n{'='*60}")
    print(f"MEDIUM ACUITY RESIDENTS ({len(medium_acuity)}):")
    print(f"{'='*60}")
    for name, score, hours in sorted(medium_acuity, key=lambda x: x[1], reverse=True):
        print(f"  {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\n{'='*60}")
    print(f"LOW ACUITY RESIDENTS ({len(low_acuity)}):")
    print(f"{'='*60}")
    for name, score, hours in sorted(low_acuity, key=lambda x: x[1], reverse=True):
        print(f"  {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    print(f"\n{'='*60}")
    print(f"INDEPENDENT RESIDENTS ({len(independent)}):")
    print(f"{'='*60}")
    for name, score, hours in sorted(independent, key=lambda x: x[1], reverse=True):
        print(f"  {name:30s} | Score: {score:2.0f} | Hours: {hours:5.2f}")
    
    if no_data:
        print(f"\n{'='*60}")
        print(f"NO ADL DATA ({len(no_data)}):")
        print(f"{'='*60}")
        for name in sorted(no_data):
            print(f"  {name}")

if __name__ == '__main__':
    csv_file = 'Mill View Memory Care (50R455) - Answer Export 12-01-2025.csv'
    analyze_acuity(csv_file)

