import pandas as pd

df = pd.read_excel('Data.xlsx')
df['diagnosis_clean'] = (
    df['Diagnosis']
    .str.lower()
    .str.strip()
    .str.replace(r'[^a-z0-9\s]', '', regex=True)  # remove punctuation
    .str.replace(r'\s+', ' ', regex=True)         # collapse multiple spaces
)

from rapidfuzz import fuzz, process

unique_vals = df['diagnosis_clean'].dropna().unique().tolist()

mapping = {}
processed = set()

for val in unique_vals:
    if val in processed:
        continue
    # find all values similar to this one
    matches = process.extract(
        val, unique_vals, scorer=fuzz.token_sort_ratio, limit=None
    )
    similar = [m[0] for m in matches if m[1] >= 80]  # tune threshold
    
    for s in similar:
        mapping[s] = val  # map all similar variants to one canonical name
        processed.add(s)

df['diagnosis_group'] = df['diagnosis_clean'].map(mapping)

print(df['diagnosis_group'].value_counts() )