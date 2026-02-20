import socket
import urllib.request
import sys

def check(url, name):
    try:
        print(f"Testing {name}: {url}")
        with urllib.request.urlopen(url, timeout=2) as r:
            print(f"{name} OK: {r.getcode()}")
            if r.getcode() == 200:
                print(f"{name} DATA: {r.read().decode('utf-8')[:50]}...")
    except Exception as e:
        print(f"{name} FAIL: {e}")

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except: return '127.0.0.1'
    finally: s.close()

ip = get_ip()
print(f"Detected System IP: {ip}")
check('http://127.0.0.1:8000/health', 'Localhost')
check(f'http://{ip}:8000/health', 'Network Interface')
check('http://127.0.0.1:8000/api/profile/test_user/exists', 'Compat Endpoint')
