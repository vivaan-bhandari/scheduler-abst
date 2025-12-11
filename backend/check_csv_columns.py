"""
Quick script to check CSV column names in uploaded files
Run this to see what columns your CSV file has before uploading.
"""
import pandas as pd
import sys

if len(sys.argv) < 2:
    print("Usage: python check_csv_columns.py <path_to_csv_file>")
    sys.exit(1)

csv_file = sys.argv[1]

try:
    df = pd.read_csv(csv_file)
    print(f"\n{'='*60}")
    print(f"CSV File: {csv_file}")
    print(f"Total Rows: {len(df)}")
    print(f"{'='*60}\n")
    
    print("All Column Names:")
    print("-" * 60)
    for i, col in enumerate(df.columns, 1):
        print(f"{i:2d}. {col}")
    
    print(f"\n{'='*60}")
    print("Checking for Task Time Column:")
    print("-" * 60)
    
    task_time_candidates = [
        'TaskTime', 'Task Time', 'Time', 'Minutes', 'Min', 
        'TimePerTask', 'Time Per Task', 'MinutesPerTask', 'Minutes Per Task',
        'TaskMinutes', 'Task Minutes', 'Duration', 'MinPerTask', 'Min Per Task'
    ]
    
    found_columns = []
    for candidate in task_time_candidates:
        if candidate in df.columns:
            found_columns.append(candidate)
            # Show sample values
            sample_values = df[candidate].dropna().head(5).tolist()
            print(f"✓ Found: '{candidate}'")
            print(f"  Sample values: {sample_values}")
    
    if not found_columns:
        print("✗ No task time column found with expected names")
        print("\nLooking for columns containing 'time', 'minute', 'duration':")
        time_related = [col for col in df.columns if any(word in col.lower() for word in ['time', 'minute', 'duration', 'min'])]
        if time_related:
            for col in time_related:
                sample_values = df[col].dropna().head(3).tolist()
                print(f"  - {col}: {sample_values}")
        else:
            print("  No time-related columns found")
    
    print(f"\n{'='*60}")
    print("Checking Required Columns for ADL Upload:")
    print("-" * 60)
    
    required_for_answer_export = ['QuestionText', 'ResidentName']
    required_for_resident_based = ['Name', 'TotalCareTime']
    
    answer_export_check = all(col in df.columns for col in required_for_answer_export)
    resident_based_check = all(col in df.columns for col in required_for_resident_based)
    
    if answer_export_check:
        print("✓ ADL Answer Export format detected")
        print(f"  Required columns: {', '.join(required_for_answer_export)}")
    elif resident_based_check:
        print("✓ Resident-based format detected")
        print(f"  Required columns: {', '.join(required_for_resident_based)}")
    else:
        print("✗ CSV format not recognized")
        print(f"  Missing for Answer Export: {[col for col in required_for_answer_export if col not in df.columns]}")
        print(f"  Missing for Resident-based: {[col for col in required_for_resident_based if col not in df.columns]}")
    
    print(f"\n{'='*60}\n")
    
except Exception as e:
    print(f"Error reading CSV file: {e}")
    sys.exit(1)

