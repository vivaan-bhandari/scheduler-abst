#!/usr/bin/env python
"""
Management command to delete all ADL data for a specific facility.
Usage: python manage.py delete_facility_adl_data "Mill View Memory Care"
"""
from django.core.management.base import BaseCommand
from residents.models import Facility
from adls.models import ADL, WeeklyADLEntry, WeeklyADLSummary


class Command(BaseCommand):
    help = 'Delete all ADL data for a specific facility'

    def add_arguments(self, parser):
        parser.add_argument(
            'facility_name',
            type=str,
            help='Name of the facility (e.g., "Mill View Memory Care")',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion (required to actually delete)',
        )
        parser.add_argument(
            '--include-residents',
            action='store_true',
            help='Also delete residents and facility sections (NOT the facility itself)',
        )

    def handle(self, *args, **options):
        facility_name = options['facility_name']
        confirm = options['confirm']
        include_residents = options['include_residents']
        
        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    f'\n⚠️  WARNING: This will delete ALL ADL data for "{facility_name}"'
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    'This includes:\n'
                    '  - All ADL records\n'
                    '  - All WeeklyADLEntry records\n'
                    '  - All WeeklyADLSummary records\n'
                )
            )
            if include_residents:
                self.stdout.write(
                    self.style.ERROR(
                        '  - ALL RESIDENTS in this facility\n'
                        '  - ALL FACILITY SECTIONS\n'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        '  - (Residents and Facility will NOT be deleted)\n'
                    )
                )
            self.stdout.write(
                self.style.ERROR(
                    '⚠️  Run with --confirm to actually delete the data\n'
                )
            )
            return
        
        try:
            # Find facility by name (case insensitive)
            facility = Facility.objects.filter(name__icontains=facility_name).first()
            
            if not facility:
                self.stdout.write(
                    self.style.ERROR(
                        f'❌ Facility "{facility_name}" not found!'
                    )
                )
                self.stdout.write('\nAvailable facilities:')
                for f in Facility.objects.all():
                    self.stdout.write(f'  - {f.name} (ID: {f.id})')
                return
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Found facility: {facility.name} (ID: {facility.id})\n'
                )
            )
            
            # Get all residents in this facility
            from residents.models import Resident, FacilitySection
            sections = FacilitySection.objects.filter(facility=facility)
            residents = Resident.objects.filter(facility_section__in=sections)
            
            self.stdout.write(f'Found {residents.count()} residents in {sections.count()} section(s)')
            
            # Count records to be deleted
            adl_count = ADL.objects.filter(resident__in=residents).count()
            weekly_entry_count = WeeklyADLEntry.objects.filter(resident__in=residents).count()
            summary_count = WeeklyADLSummary.objects.filter(resident__in=residents).count()
            
            self.stdout.write('\nRecords to be deleted:')
            self.stdout.write(f'  - ADL records: {adl_count}')
            self.stdout.write(f'  - WeeklyADLEntry records: {weekly_entry_count}')
            self.stdout.write(f'  - WeeklyADLSummary records: {summary_count}')
            
            if adl_count == 0 and weekly_entry_count == 0 and summary_count == 0:
                self.stdout.write(
                    self.style.WARNING(
                        '\n⚠️  No ADL data found to delete!'
                    )
                )
                return
            
            # Delete in order (respecting foreign key constraints)
            self.stdout.write('\nDeleting records...')
            
            # Delete WeeklyADLSummary first (depends on residents)
            if summary_count > 0:
                deleted_summaries = WeeklyADLSummary.objects.filter(resident__in=residents).delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Deleted {deleted_summaries[0]} WeeklyADLSummary records'
                    )
                )
            
            # Delete WeeklyADLEntry
            if weekly_entry_count > 0:
                deleted_entries = WeeklyADLEntry.objects.filter(resident__in=residents).delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Deleted {deleted_entries[0]} WeeklyADLEntry records'
                    )
                )
            
            # Delete ADL records
            if adl_count > 0:
                deleted_adls = ADL.objects.filter(resident__in=residents).delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Deleted {deleted_adls[0]} ADL records'
                    )
                )
            
            # Optionally delete residents and sections
            if include_residents:
                self.stdout.write('\nDeleting residents and sections...')
                
                resident_count = residents.count()
                section_count = sections.count()
                
                # Delete residents (will cascade delete ADLs if any remain, but we already deleted them)
                residents.delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Deleted {resident_count} residents'
                    )
                )
                
                # Delete facility sections
                sections.delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ Deleted {section_count} facility sections'
                    )
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ Successfully deleted ALL data for "{facility.name}"!'
                    )
                )
                self.stdout.write('\nNote: The Facility itself was NOT deleted.')
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ Successfully deleted all ADL data for "{facility.name}"!'
                    )
                )
                self.stdout.write('\nNote: Residents and Facility were NOT deleted.')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'\n❌ Error: {str(e)}'
                )
            )
            import traceback
            traceback.print_exc()

