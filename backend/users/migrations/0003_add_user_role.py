from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0002_alter_facilityaccess_role'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE auth_user ADD COLUMN role VARCHAR(20) DEFAULT 'user';",
            reverse_sql="ALTER TABLE auth_user DROP COLUMN role;"
        ),
    ] 