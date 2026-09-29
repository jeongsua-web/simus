from smoke import client,call,KEY
from uuid import uuid4
admin,visitor=client(),client()
assert call(admin,'/api/admin/login',{'key':KEY.read_text().strip()})[0]==200
r=call(admin,'/api/admin/start',{'duration':300,'scale':0.1})[1]
assert call(visitor,'/api/join',{'round':r['id']})[0]==200
s=call(visitor,'/api/me?round='+r['id'])[1]['situations'][0]
assert call(visitor,'/api/choice',{'round':r['id'],'situation':s['id'],'choice':s['choices'][0]['id'],'request':str(uuid4())})[0]==200
print('Unity live test round:',r['id'])
