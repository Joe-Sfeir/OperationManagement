"""Extract the two NTG workbooks into JSON the app can bundle (offline, no backend).

Usage: python3 -I tools/extract_data.py data/NTG_Data_Inventory_v1.xlsx data/NTG_History_2026_Clean.xlsx src/data

Nothing is edited or tuned here. Values are copied as they are in the workbooks.
Provenance tag mapping (inventory 'Status' -> tag shown in the UI):
  HAVE (NTG) -> N      HAVE (visit), HAVE (team) -> V      CALC -> C
  ESTIMATE, EXCLUDED, X - NTG, X - TEAM -> S (estimate or missing; see ASSUMPTIONS.md)
"""
import json, sys, collections, datetime
import openpyxl

inv_path, hist_path, out_dir = sys.argv[1:4]
TAG = {'HAVE (NTG)': 'N', 'HAVE (visit)': 'V', 'HAVE (team)': 'V', 'CALC': 'C',
       'ESTIMATE': 'S', 'EXCLUDED': 'S', 'X - NTG': 'S', 'X - TEAM': 'S'}

def s(v):
    if v is None: return ''
    if isinstance(v, float) and v.is_integer(): return str(int(v))
    if isinstance(v, (datetime.datetime, datetime.date)): return str(v)[:10]
    return str(v).strip()

# ---- Inventory ------------------------------------------------------------
wb = openpyxl.load_workbook(inv_path, data_only=True)
ws = wb['Inventory']
rows = list(ws.iter_rows(values_only=True))
head = [s(h) for h in rows[0]]
inventory = []
for r in rows[1:]:
    if r[0] is None: continue
    d = dict(zip(head, r))
    status = s(d['Status'])
    inventory.append({
        'row': int(d['#']), 'stage': s(d['Stage']), 'parameter': s(d['Parameter']),
        'value': d['Value'] if isinstance(d['Value'], (int, float)) else s(d['Value']),
        'unit': s(d['Unit']), 'status': status, 'tag': TAG[status], 'source': s(d['Source']),
        'confidence': s(d['Confidence']), 'usedIn': s(d['Used in']),
        'replacedBy': s(d['Replaced by (Form 2 Q / action)']), 'notes': s(d['Notes']),
    })
sources = [{'id': s(r[0]), 'reference': s(r[1]), 'link': s(r[2])}
           for r in list(wb['Sources'].iter_rows(values_only=True))[1:] if r[0]]
json.dump({'inventory': inventory, 'sources': sources}, open(f'{out_dir}/inventory.json', 'w'), ensure_ascii=False, indent=1)

# ---- History ----------------------------------------------------------------
wb = openpyxl.load_workbook(hist_path, data_only=True)
weekly = {}
for sku in ('CTT4', 'CTT2', 'HTT2'):
    rr = list(wb[f'Weekly {sku}'].iter_rows(values_only=True))
    out = []
    for r in rr[1:]:
        if r[0] is None or not s(r[0])[:4].isdigit(): continue
        out.append({'week': s(r[0]), 'opening': r[1], 'produced': r[2], 'sold': r[3], 'returns': r[4],
                    'closing': r[5], 'lowest': r[6], 'productionDays': r[7], 'salesDocs': r[8], 'min': r[9], 'cap': r[10]})
    weekly[sku] = out
monthly = [{'month': s(r[0]), 'sold': {'CTT4': r[1], 'CTT2': r[2], 'HTT2': r[3]},
            'produced': {'CTT4': r[4], 'CTT2': r[5], 'HTT2': r[6]}}
           for r in list(wb['Monthly'].iter_rows(values_only=True))[1:] if r[0]]
summary = [[s(c) for c in r] for r in wb['Summary'].iter_rows(values_only=True) if any(c is not None for c in r)]
# Daily production per SKU (Production warehouse, 'Produced goods (in)')
daily = collections.defaultdict(lambda: collections.defaultdict(int))
for r in list(wb['Daily transactions'].iter_rows(values_only=True))[1:]:
    if r[0] and r[1] == 'Production' and s(r[3]).startswith('Produced'):
        daily[s(r[2])[:10]][r[0]] += int(r[5])
daily_production = [{'date': d, **{k: daily[d].get(k, 0) for k in ('CTT4', 'CTT2', 'HTT2')}} for d in sorted(daily)]
json.dump({'weekly': weekly, 'monthly': monthly, 'summary': summary, 'dailyProduction': daily_production},
          open(f'{out_dir}/history.json', 'w'), ensure_ascii=False, indent=1)
print(f'inventory rows: {len(inventory)}, sources: {len(sources)}, weeks: {len(weekly["CTT4"])}, production days: {len(daily_production)}')
