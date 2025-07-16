import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_authentication():
    print("Testing ABST Authentication System")
    print("=" * 40)
    
    # Test 1: Register a new user
    print("\n1. Testing User Registration...")
    register_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "first_name": "Test",
        "last_name": "User"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/users/register/", json=register_data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 201:
            print("✅ Registration successful!")
            user_data = response.json()
            token = user_data['token']
            print(f"Token: {token[:20]}...")
        else:
            print(f"❌ Registration failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return
    
    # Test 2: Login with the registered user
    print("\n2. Testing User Login...")
    login_data = {
        "username": "testuser",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/users/login/", json=login_data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ Login successful!")
            login_response = response.json()
            print(f"Token: {login_response['token'][:20]}...")
        else:
            print(f"❌ Login failed: {response.text}")
    except Exception as e:
        print(f"❌ Login error: {e}")
    
    # Test 3: Access protected endpoint with token
    print("\n3. Testing Protected Endpoint Access...")
    headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/adls/", headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ Protected endpoint access successful!")
            data = response.json()
            print(f"Found {data['count']} ADL records")
        else:
            print(f"❌ Protected endpoint access failed: {response.text}")
    except Exception as e:
        print(f"❌ Protected endpoint error: {e}")
    
    # Test 4: Test ADL creation
    print("\n4. Testing ADL Creation...")
    adl_data = {
        "resident": 1,  # Assuming resident with ID 1 exists
        "question_text": "Test ADL Question",
        "minutes": 30,
        "frequency": 2,
        "status": "active"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/adls/", json=adl_data, headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 201:
            print("✅ ADL creation successful!")
            adl_response = response.json()
            print(f"Created ADL ID: {adl_response['id']}")
        else:
            print(f"❌ ADL creation failed: {response.text}")
    except Exception as e:
        print(f"❌ ADL creation error: {e}")
    
    # Test 5: Logout
    print("\n5. Testing User Logout...")
    try:
        response = requests.post(f"{BASE_URL}/users/logout/", headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ Logout successful!")
        else:
            print(f"❌ Logout failed: {response.text}")
    except Exception as e:
        print(f"❌ Logout error: {e}")
    
    print("\n" + "=" * 40)
    print("Authentication testing completed!")

if __name__ == "__main__":
    test_authentication() 