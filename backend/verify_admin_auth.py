import requests
import json
import os
import sys

# Test against running Django server or DRF API Client directly via Django test client

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
import django
django.setup()

from rest_framework.test import APIClient

def verify():
    client = APIClient()
    
    # 1. Test Login Endpoint
    login_url = '/api/auth/login/'
    print(f"1. Testing POST {login_url}...")
    response = client.post(login_url, {'username': 'admin', 'password': 'AdminPass2026!'}, format='json')
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        role = data.get('role')
        print(f"   [SUCCESS] Status 200 OK")
        print(f"   Username: {data.get('username')}")
        print(f"   Role: {role}")
        print(f"   Token: {token[:10]}...")
    else:
        print(f"   [FAILED] Status {response.status_code}: {response.content}")
        sys.exit(1)

    # 2. Test Protected Dashboard Endpoint /api/dashboard/stats/
    stats_url = '/api/dashboard/stats/'
    print(f"\n2. Testing GET {stats_url} with Token Header...")
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    stats_res = client.get(stats_url)
    
    if stats_res.status_code == 200:
        sdata = stats_res.json()
        print(f"   [SUCCESS] Status 200 OK")
        print(f"   Total Leads: {sdata.get('total_leads')}")
        print(f"   Status Breakdown: {sdata.get('status_breakdown')}")
    else:
        print(f"   [FAILED] Status {stats_res.status_code}: {stats_res.content}")
        sys.exit(1)

    # 3. Test Protected Leads Endpoint /api/leads/
    leads_url = '/api/leads/'
    print(f"\n3. Testing GET {leads_url} with Token Header...")
    leads_res = client.get(leads_url)
    
    if leads_res.status_code == 200:
        ldata = leads_res.json()
        results = ldata.get('results', ldata)
        print(f"   [SUCCESS] Status 200 OK")
        print(f"   Fetched {len(results)} lead(s).")
    else:
        print(f"   [FAILED] Status {leads_res.status_code}: {leads_res.content}")
        sys.exit(1)

    print("\n--- ALL API VERIFICATIONS PASSED ---")

if __name__ == '__main__':
    verify()
