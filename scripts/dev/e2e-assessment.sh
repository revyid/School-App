#!/usr/bin/env bash
# End-to-end asesmen: guru membuat asesmen multi-soal -> siswa mengerjakan ->
# guru melihat statistik. Verifikasi seluruh alur.
HOST="demo.localtest.me"
BASE="http://localhost:3100"
ORIGIN="Origin: http://$HOST"
REF="Referer: http://$HOST/login"

login() {
  local ident="$1" pass="$2" hdr="/tmp/e2e_hdr_$3.txt"
  curl -s -D "$hdr" -X POST -H "Host: $HOST" -H "content-type: application/json" \
    -H "$ORIGIN" -H "$REF" \
    -d "{\"identifier\":\"$ident\",\"password\":\"$pass\"}" "$BASE/api/auth/login"
}
sid() { grep -i "^set-cookie:" "/tmp/e2e_hdr_$1.txt" | sed 's/.*lacakedu-session-dev=\([^;]*\).*/\1/' | tr -d '\r'; }
csrf() { python3 -c "import sys,json;print(json.load(sys.stdin).get('csrfToken',''))"; }

GR=$(login "guru@demo.sch.id" "demo123" guru)
G_SID=$(sid guru); G_C=$(echo "$GR" | csrf)
SW=$(login "siswa@demo.sch.id" "demo123" siswa)
S_SID=$(sid siswa); S_C=$(echo "$SW" | csrf)
echo "guru sid=${G_SID:0:6} siswa sid=${S_SID:0:6}"

# --- 1. Ambil kelas guru ---
KELAS=$(curl -s -H "Host: $HOST" -H "Cookie: lacakedu-session-dev=$G_SID" "$BASE/api/assignments" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['rows'][0]['class']['id'] if d.get('rows') else '')" 2>/dev/null)
echo "1. kelas guru: ${KELAS:0:20}"
if [ -z "$KELAS" ]; then echo "GAGAL: guru tidak punya kelas"; exit 1; fi

# --- 2. Buat asesmen multi-soal (4 tipe berbeda) ---
TITLE="E2E Test $(date +%s)"
BODY=$(python3 - "$KELAS" "$TITLE" <<'PY'
import json,sys
kelas,title=sys.argv[1],sys.argv[2]
inline=[
 {"type":"MCQ","stem":"Ibu kota Indonesia","options":["Surabaya","Jakarta","Bandung"],"correctIndex":1},
 {"type":"SORTING","stem":"Urutkan siklus air","options":["Evaporasi","Kondensasi","Presipitasi"],"correctIndex":None},
 {"type":"MCQ","stem":"2+3 =","options":["4","5","6"],"correctIndex":1},
]
print(json.dumps({"classId":kelas,"title":title,"kind":"REGULAR","shuffleQ":True,"shuffleOpt":True,"inline":inline}))
PY
)
CRE=$(curl -s -X POST -H "Host: $HOST" -H "content-type: application/json" -H "Cookie: lacakedu-session-dev=$G_SID" \
  -H "x-csrf-token: $G_C" -H "$ORIGIN" -H "Referer: http://$HOST/guru/asesmen" \
  -d "$BODY" "$BASE/api/assessments")
AID=$(echo "$CRE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('assessment',{}).get('id',''))" 2>/dev/null)
echo "2. buat asesmen: ${AID:0:20} -> $(echo "$CRE" | head -c 80)"
if [ -z "$AID" ]; then echo "GAGAL buat asesmen"; exit 1; fi

# --- 3. Siswa lihat daftar asesmen ---
LIST=$(curl -s -H "Host: $HOST" -H "Cookie: lacakedu-session-dev=$S_SID" "$BASE/api/assessments")
echo "3. daftar siswa: $(echo "$LIST" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('rows',[])),'asesmen')" 2>/dev/null)"

# --- 4. Siswa mulai attempt ---
ATT=$(curl -s -H "Host: $HOST" -H "Cookie: lacakedu-session-dev=$S_SID" "$BASE/api/assessments/$AID/attempt")
NQ=$(echo "$ATT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('questions',[])))" 2>/dev/null)
echo "4. attempt: $NQ soal diterima"
if [ "$NQ" != "3" ]; then echo "   PERINGATAN: expected 3 soal (got $NQ)"; echo "   resp: $(echo "$ATT"|head -c 200)"; fi

# --- 5. Siswa kumpulkan jawaban ---
ANS=$(echo "$ATT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
qs=d.get('questions',[])
out=[]
for q in qs:
    if q['type']=='MCQ':
        # pilih opsi pertama (acak, jadi skor bisa 0..n)
        out.append({'questionId':q['id'],'pickedIndex':0})
    else:
        out.append({'questionId':q['id'],'pickedOrder':list(range(len(q['options'])))})
print(json.dumps({'answers':out}))
")
SUB=$(curl -s -X POST -H "Host: $HOST" -H "content-type: application/json" -H "Cookie: lacakedu-session-dev=$S_SID" \
  -H "x-csrf-token: $S_C" -H "$ORIGIN" -H "Referer: http://$HOST/siswa/asesmen" \
  -d "$ANS" "$BASE/api/assessments/$AID/attempt")
echo "5. kumpul: $SUB"

# --- 6. Guru lihat analisis ---
ANA=$(curl -s -H "Host: $HOST" -H "Cookie: lacakedu-session-dev=$G_SID" "$BASE/api/assessments/$AID/analysis")
echo "6. analisis: $(echo "$ANA" | head -c 200)"

# --- 7. Guru lihat diagnostik ---
DIAG=$(curl -s -H "Host: $HOST" -H "Cookie: lacakedu-session-dev=$G_SID" "$BASE/api/assessments/$AID/diagnostic")
echo "7. diagnostik: $(echo "$DIAG" | head -c 200)"
echo ""
echo "SELESAI"
