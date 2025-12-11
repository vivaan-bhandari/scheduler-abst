from django.core.management.base import BaseCommand
from residents.models import Facility


class Command(BaseCommand):
    help = 'Update facility shift formats based on location'

    def handle(self, *args, **options):
        # Oregon facilities use 2-shift format (Day/Night - 12 hour shifts)
        oregon_facilities = [
            'Mill View Memory Care',
            'Mill View',
        ]
        
        # California facilities use 3-shift format (Day/Swing/NOC - 8 hour shifts)
        california_facilities = [
            'Buena Vista',
            'La Posada',
        ]
        
        updated_2_shift = 0
        updated_3_shift = 0
        
        # Update Oregon facilities to 2-shift format
        for facility_name in oregon_facilities:
            facilities = Facility.objects.filter(name__icontains=facility_name)
            for facility in facilities:
                if facility.shift_format != '2_shift':
                    facility.shift_format = '2_shift'
                    facility.save()
                    updated_2_shift += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Updated {facility.name} to 2-shift format')
                    )
        
        # Update California facilities to 3-shift format
        for facility_name in california_facilities:
            facilities = Facility.objects.filter(name__icontains=facility_name)
            for facility in facilities:
                if facility.shift_format != '3_shift':
                    facility.shift_format = '3_shift'
                    facility.save()
                    updated_3_shift += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Updated {facility.name} to 3-shift format')
                    )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary: Updated {updated_2_shift} facilities to 2-shift format, '
                f'{updated_3_shift} facilities to 3-shift format'
            )
        )

