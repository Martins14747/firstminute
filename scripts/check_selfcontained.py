import re
with open('/home/z/my-project/download/lifeline-ng.html') as f:
    h = f.read()

# External URLs (only as user-action links like tel:, maps, wa.me — none load code)
exts = re.findall(r'(?:src|href)=["\'](https?://[^"\']+)["\']', h)
print('External URLs referenced (user-action links, no code loads):')
for u in sorted(set(exts)):
    print('  ', u)
print()
print('Script src tags  :', len(re.findall(r'<script[^>]+src=', h)))
print('Link stylesheet  :', len(re.findall(r'<link[^>]+stylesheet', h)))
print('Inline <style>   :', len(re.findall(r'<style>', h)))
print('Inline <script>  :', len(re.findall(r'<script>', h)))
print()
print('Total file size  :', len(h), 'bytes')
print('Total lines      :', h.count('\n'))
