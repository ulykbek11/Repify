import sys
print('stdout type:', type(sys.stdout))
print('has reconfigure:', hasattr(sys.stdout, 'reconfigure'))
print('encoding before:', sys.stdout.encoding)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print('encoding after:', sys.stdout.encoding)
try:
    print('Testing emoji: \U0001f4e5')
    print('Emoji OK')
except Exception as e:
    print('Emoji FAILED:', type(e).__name__, str(e))
