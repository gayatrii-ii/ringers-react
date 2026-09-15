import re
import os
import glob

def check_sql_file(filepath):
    filename = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    tables = re.findall(r'CREATE TABLE IF NOT EXISTS ([\w\.]+)', content, re.IGNORECASE)
    schemas = re.findall(r'CREATE SCHEMA IF NOT EXISTS ([\w]+)', content, re.IGNORECASE)
    open_paren = content.count('(')
    close_paren = content.count(')')

    assert open_paren == close_paren, f"Mismatched parentheses in {filename}: {open_paren} vs {close_paren}"
    return tables, schemas

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    init_sql = os.path.join(base_dir, 'init_database.sql')
    tables, schemas = check_sql_file(init_sql)
    print(f"Master file: {len(schemas)} schemas, {len(tables)} tables verified.")
    assert len(schemas) == 9, f"Expected 9 schemas, got {len(schemas)}"
    assert len(tables) == 21, f"Expected 21 tables, got {len(tables)}"

    # Check Flyway migrations
    migration_files = sorted(glob.glob(os.path.join(base_dir, 'db', 'migration', 'V*__*.sql')))
    print(f"\nVerifying {len(migration_files)} Flyway migration files...")
    assert len(migration_files) == 12, f"Expected 12 Flyway migrations, got {len(migration_files)}"
    all_flyway_tables = []
    for mf in migration_files:
        tbls, _ = check_sql_file(mf)
        all_flyway_tables.extend(tbls)
        print(f"  {os.path.basename(mf)}: OK ({len(tbls)} tables)")

    assert len(all_flyway_tables) == 21, f"Expected 21 total tables in Flyway, got {len(all_flyway_tables)}"
    print(f"\nALL 21 TABLES AND 12 MIGRATIONS VERIFIED 100% SUCCESFULLY!")
