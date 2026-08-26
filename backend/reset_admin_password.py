import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User

def reset_admin():
    username = 'admin'
    password = 'AdminPass2026!'
    email = 'sujitapatel787@gmail.com'

    user, created = User.objects.get_or_create(username=username, defaults={'email': email, 'is_staff': True, 'is_superuser': True})
    
    old_hash = user.password
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.save()

    print(f"User '{username}' ({'created' if created else 'updated'}).")
    print(f"Old password hash: {old_hash[:20]}...")
    print(f"New password hash: {user.password[:20]}...")
    print("Password successfully updated using Django set_password PBKDF2 hashing.")
    return username, password

if __name__ == '__main__':
    reset_admin()
