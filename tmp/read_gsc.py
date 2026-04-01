import zipfile
import xml.etree.ElementTree as ET

def get_shared_strings(z):
    try:
        xml_content = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(xml_content)
        ns = {'ns': root.tag.split('}')[0].strip('{')} if '}' in root.tag else {}
        if ns:
            return [t.text or '' for t in root.findall('.//ns:t', ns)]
        return [t.text or '' for t in root.findall('.//t')]
    except:
        return []

def read_sheet(z, sheet_path, shared_strings):
    xml_content = z.read(sheet_path)
    root = ET.fromstring(xml_content)
    ns = {'ns': root.tag.split('}')[0].strip('{')} if '}' in root.tag else {}
    rows = root.findall('.//ns:row', ns) if ns else root.findall('.//row')
    
    data = []
    for row in rows[:50]: # limit to 50 rows per sheet
        row_data = []
        cells = row.findall('.//ns:c', ns) if ns else row.findall('.//c')
        for c in cells:
            v_node = c.find('.//ns:v', ns) if ns else c.find('.//v')
            val = v_node.text if v_node is not None else ''
            if c.get('t') == 's' and val.isdigit():
                val = shared_strings[int(val)]
            row_data.append(val or '')
        data.append(row_data)
    return data

try:
    with zipfile.ZipFile(r'e:\code\ai开发\code\pixel-swift\docs\https___pixelswift.site_-Performance-on-Search-2026-04-01.xlsx') as z:
        strings = get_shared_strings(z)
        wb_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(wb_xml)
        ns = {'ns': wb_root.tag.split('}')[0].strip('{')} if '}' in wb_root.tag else {}
        sheets = wb_root.findall('.//ns:sheet', ns) if ns else wb_root.findall('.//sheet')
        
        rels_xml = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        r_ns = {'ns': rels_root.tag.split('}')[0].strip('{')} if '}' in rels_root.tag else {}
        
        for sheet in sheets:
            name = sheet.get('name')
            rId = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            print(f"\n======== Sheet: {name} ========")
            
            for rel in (rels_root.findall('.//ns:Relationship', r_ns) if r_ns else rels_root.findall('.//Relationship')):
                if rel.get('Id') == rId:
                    target = rel.get('Target')
                    sheet_data = read_sheet(z, f'xl/{target}', strings)
                    for r in sheet_data:
                        print(" | ".join(map(str, r)))
except Exception as e:
    print(f"Error: {e}")
