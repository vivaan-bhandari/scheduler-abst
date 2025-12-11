"""
Management command to fix WeeklyADLEntry records that have 0 minutes_per_occurrence
by copying minutes from corresponding ADL records.

Usage:
    python manage.py fix_weekly_entry_minutes --week-start 2025-12-01
    python manage.py fix_weekly_entry_minutes --all
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from adls.models import WeeklyADLEntry, ADL
from datetime import datetime, date, timedelta


class Command(BaseCommand):
    help = 'Fix WeeklyADLEntry records with 0 minutes by copying from ADL records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--week-start',
            type=str,
            help='Week start date (YYYY-MM-DD format). If not provided, fixes all weeks with 0 minutes.',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Fix all WeeklyADLEntry records with 0 minutes, regardless of week',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )

    def handle(self, *args, **options):
        week_start_str = options.get('week_start')
        fix_all = options.get('all', False)
        dry_run = options.get('dry_run', False)

        # Build query
        queryset = WeeklyADLEntry.objects.filter(minutes_per_occurrence=0)
        
        if week_start_str:
            try:
                week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
                queryset = queryset.filter(week_start_date=week_start)
                self.stdout.write(self.style.SUCCESS(f'Fixing entries for week starting: {week_start}'))
            except ValueError:
                self.stdout.write(self.style.ERROR(f'Invalid date format. Use YYYY-MM-DD'))
                return
        elif not fix_all:
            # Default to current week if no week specified
            today = date.today()
            days_since_monday = today.weekday()
            week_start = today - timedelta(days=days_since_monday)
            queryset = queryset.filter(week_start_date=week_start)
            self.stdout.write(self.style.SUCCESS(f'Fixing entries for current week starting: {week_start}'))

        entries_to_fix = queryset.select_related('resident', 'adl_question')
        total_count = entries_to_fix.count()

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No entries with 0 minutes found to fix.'))
            return

        self.stdout.write(f'\nFound {total_count} entries with 0 minutes_per_occurrence')

        fixed_count = 0
        not_found_count = 0
        skipped_count = 0

        for entry in entries_to_fix:
            # Try to find matching ADL record
            adl = None
            
            # First try by adl_question
            if entry.adl_question:
                adl = ADL.objects.filter(
                    resident=entry.resident,
                    adl_question=entry.adl_question
                ).first()
            
            # If not found, try by question_text
            if not adl and entry.question_text:
                adl = ADL.objects.filter(
                    resident=entry.resident,
                    question_text=entry.question_text
                ).first()

            if adl and adl.minutes > 0:
                if dry_run:
                    self.stdout.write(
                        f'Would update: {entry.resident.name} - {entry.question_text[:30]}... '
                        f'({entry.minutes_per_occurrence} -> {adl.minutes} minutes)'
                    )
                else:
                    # Calculate new total_minutes_week
                    new_total_minutes = adl.minutes * entry.frequency_per_week
                    
                    entry.minutes_per_occurrence = adl.minutes
                    entry.total_minutes_week = new_total_minutes
                    entry.total_hours_week = new_total_minutes / 60.0
                    entry.save()
                    
                    self.stdout.write(
                        f'Updated: {entry.resident.name} - {entry.question_text[:30]}... '
                        f'(0 -> {adl.minutes} minutes)'
                    )
                fixed_count += 1
            elif adl and adl.minutes == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipped: {entry.resident.name} - {entry.question_text[:30]}... '
                        f'(ADL also has 0 minutes)'
                    )
                )
                skipped_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'No matching ADL found: {entry.resident.name} - {entry.question_text[:30]}...'
                    )
                )
                not_found_count += 1

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(f'  Total entries checked: {total_count}')
        if dry_run:
            self.stdout.write(f'  Would fix: {fixed_count}')
        else:
            self.stdout.write(f'  Fixed: {fixed_count}')
        self.stdout.write(f'  Skipped (ADL also 0): {skipped_count}')
        self.stdout.write(f'  Not found (no matching ADL): {not_found_count}')
        self.stdout.write('='*60)

        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a dry run. Use without --dry-run to apply changes.'))

