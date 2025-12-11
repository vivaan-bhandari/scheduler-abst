#!/usr/bin/env python3
"""
Verification script to check if hourly rates from Rate History CSV match displayed rates.
Compares the most recent rate per employee against expected values.
"""

import csv
from datetime import datetime
from collections import defaultdict

def parse_date(date_str):
    """Parse date string in MM/DD/YYYY format"""
    try:
        return datetime.strptime(date_str.strip(), '%m/%d/%Y').date()
    except:
        return None

def verify_rates(csv_file):
    """Read CSV and extract most recent hourly rate per employee"""
    employee_rates = {}  # {employee_id: {date: rate}}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            employee_id = row.get('EE Code', '').strip()
            if not employee_id:
                continue
            
            # Only process hourly rates
            pay_type = row.get('Pay Type', '').strip()
            if pay_type.lower() not in ['hourly', 'h']:
                continue
            
            # Get effective date
            date_str = row.get('Effective Date', '').strip()
            effective_date = parse_date(date_str) if date_str else None
            
            # Get amount (hourly rate)
            amount_str = row.get('Amount', '').strip()
            if amount_str:
                try:
                    # Remove any commas, convert to float
                    rate = float(amount_str.replace(',', ''))
                    
                    if employee_id not in employee_rates:
                        employee_rates[employee_id] = {}
                    
                    # Use effective_date as key, or use a default date if not available
                    date_key = effective_date if effective_date else datetime.now().date()
                    employee_rates[employee_id][date_key] = rate
                except (ValueError, AttributeError):
                    continue
    
    # Get most recent rate per employee
    most_recent_rates = {}
    for emp_id, rates_by_date in employee_rates.items():
        if rates_by_date:
            latest_date = max(rates_by_date.keys())
            most_recent_rates[emp_id] = {
                'rate': rates_by_date[latest_date],
                'effective_date': latest_date
            }
    
    return most_recent_rates

# Employees from the image to verify (Markham House employees)
employees_to_check = [
    {'id': '0999', 'name': 'KEMINTA DOPICH', 'expected_rate': 19.00},
    {'id': '1034', 'name': 'KRYSTAL RUJKE', 'expected_rate': 19.00},
    {'id': '1046', 'name': 'NEBWIJ WATAK', 'expected_rate': 19.50},
]

if __name__ == '__main__':
    csv_file = '20251117233256_Rate_History_Report_2025-11-17_6685272a.csv'
    rates = verify_rates(csv_file)
    
    print("=" * 80)
    print("HOURLY RATE VERIFICATION REPORT")
    print("=" * 80)
    print(f"\nTotal employees with hourly rates in CSV: {len(rates)}")
    print("\nVerifying specific employees from Markham House:\n")
    
    all_correct = True
    for emp in employees_to_check:
        emp_id = emp['id']
        expected = emp['expected_rate']
        
        if emp_id in rates:
            actual = rates[emp_id]['rate']
            effective_date = rates[emp_id]['effective_date']
            status = "✓ CORRECT" if actual == expected else "✗ MISMATCH"
            
            if actual != expected:
                all_correct = False
            
            print(f"{status}")
            print(f"  Employee ID: {emp_id} ({emp['name']})")
            print(f"  Expected Rate: ${expected:.2f}")
            print(f"  CSV Rate: ${actual:.2f}")
            print(f"  Effective Date: {effective_date}")
            print()
        else:
            print(f"✗ NOT FOUND")
            print(f"  Employee ID: {emp_id} ({emp['name']})")
            print(f"  Expected Rate: ${expected:.2f}")
            print(f"  Status: Not found in CSV")
            print()
            all_correct = False
    
    print("=" * 80)
    print(f"Overall Status: {'✓ ALL RATES CORRECT' if all_correct else '✗ SOME RATES NEED VERIFICATION'}")
    print("=" * 80)
    
    # Show all Markham House employees
    print("\n\nAll Markham House employees (Location Code: 04, Markham):\n")
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        markham_employees = []
        for row in reader:
            location = row.get('Location Description', '').strip()
            pay_type = row.get('Pay Type', '').strip()
            if 'Markham' in location and pay_type.lower() in ['hourly', 'h']:
                emp_id = row.get('EE Code', '').strip()
                name = row.get('Employee Name', '').strip()
                amount = row.get('Amount', '').strip()
                date_str = row.get('Effective Date', '').strip()
                markham_employees.append({
                    'id': emp_id,
                    'name': name,
                    'rate': float(amount.replace(',', '')) if amount else None,
                    'date': date_str
                })
    
    # Group by employee ID and get most recent
    markham_by_id = defaultdict(list)
    for emp in markham_employees:
        markham_by_id[emp['id']].append(emp)
    
    print("Most Recent Rates for Markham House Employees:")
    for emp_id, entries in sorted(markham_by_id.items()):
        # Sort by date to get most recent
        latest = max(entries, key=lambda x: parse_date(x['date']) if x['date'] and parse_date(x['date']) else datetime.min.date())
        print(f"  {emp_id}: {latest['name']:40} ${latest['rate']:6.2f} (Effective: {latest['date']})")

