from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from datetime import datetime
import sqlite3

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DATABASE'] = 'checksheet.db'

# 忁EなチEレクトリを作E
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)

# チEEタベEス初期匁E
def init_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS checksheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            image_path TEXT NOT NULL,
            hotspots TEXT NOT NULL,
            order_number TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS check_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            checksheet_id INTEGER,
            case_number TEXT,
            checked BOOLEAN DEFAULT 0,
            checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (checksheet_id) REFERENCES checksheets(id)
        )
    ''')
    
    # 既存EチEEブルにorder_numberカラムがなければ追加
    cursor.execute("PRAGMA table_info(checksheets)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'order_number' not in columns:
        cursor.execute('ALTER TABLE checksheets ADD COLUMN order_number TEXT')
    
    # 既存Echeck_recordsチEEブルにcase_numberカラムがなければ追加
    cursor.execute("PRAGMA table_info(check_records)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'case_number' not in columns:
        cursor.execute('ALTER TABLE check_records ADD COLUMN case_number TEXT')
    
    # 既存Echeck_recordsチEEブルにorder_numberカラムがなければ追加
    cursor.execute("PRAGMA table_info(check_records)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'order_number' not in columns:
        cursor.execute('ALTER TABLE check_records ADD COLUMN order_number TEXT')
    
    # 既存Echeck_recordsチEEブルにhotspot_check_statesカラムがなければ追加
    cursor.execute("PRAGMA table_info(check_records)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'hotspot_check_states' not in columns:
        cursor.execute('ALTER TABLE check_records ADD COLUMN hotspot_check_states TEXT')
    
    # 既存Echeck_recordsチEEブルにworkerカラムがなければ追加
    cursor.execute("PRAGMA table_info(check_records)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'worker' not in columns:
        cursor.execute('ALTER TABLE check_records ADD COLUMN worker TEXT')
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    # 現在のサーバーURLを取得
    host = request.host
    url = f"http://{host}"
    
    return render_template('index.html', current_url=url)

@app.route('/create', methods=['GET', 'POST'])
def create():
    if request.method == 'POST':
        name = request.form.get('name')
        order_number = request.form.get('order_number', '')
        image = request.files.get('image')
        
        if image:
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{image.filename}"
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(image_path)
            
            conn = sqlite3.connect(app.config['DATABASE'])
            cursor = conn.cursor()
            cursor.execute('INSERT INTO checksheets (name, image_path, hotspots, order_number) VALUES (?, ?, ?, ?)',
                         (name, filename, '[]', order_number))
            conn.commit()
            checksheet_id = cursor.lastrowid
            conn.close()
            
            return jsonify({'success': True, 'id': checksheet_id, 'image_path': filename})
    
    return render_template('create.html')

@app.route('/checksheet/<int:id>')
def checksheet(id):
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM checksheets WHERE id = ?', (id,))
    checksheet = cursor.fetchone()
    conn.close()
    
    if checksheet:
        return render_template('checksheet.html', 
                             checksheet_id=checksheet[0],
                             name=checksheet[1],
                             image_path=checksheet[2],
                             hotspots=json.loads(checksheet[3]),
                             order_number=checksheet[4] if len(checksheet) > 4 else '',
                             worker='')
    return "Checksheet not found", 404

@app.route('/api/hotspots', methods=['POST', 'GET'])
def save_hotspots():
    if request.method == 'GET':
        checksheet_id = request.args.get('checksheet_id')
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('SELECT hotspots FROM checksheets WHERE id = ?', (checksheet_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return jsonify({'success': True, 'hotspots': json.loads(result[0])})
        return jsonify({'success': False, 'error': 'Checksheet not found'})
    
    data = request.json
    checksheet_id = data.get('checksheet_id')
    hotspots = data.get('hotspots', [])
    
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('UPDATE checksheets SET hotspots = ? WHERE id = ?',
                 (json.dumps(hotspots), checksheet_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/order-number', methods=['POST'])
def update_order_number():
    data = request.json
    checksheet_id = data.get('checksheet_id')
    order_number = data.get('order_number', '')
    
    try:
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('UPDATE checksheets SET order_number = ? WHERE id = ?',
                     (order_number, checksheet_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/check', methods=['POST'])
def check_hotspot():
    data = request.json
    print(f"Check request data: {data}")
    checksheet_id = data.get('checksheet_id')
    order_number = data.get('order_number')
    checked = data.get('checked', True)
    print(f"Checking: checksheet_id={checksheet_id}, order_number={order_number}, checked={checked}")
    
    if not order_number:
        print("Error: order_number is missing")
        return jsonify({'success': False, 'error': 'order_number is required'})
    
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO check_records (checksheet_id, order_number, checked, checked_at, hotspot_check_states, worker)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ''', (checksheet_id, order_number, checked, json.dumps(data.get('hotspot_check_states', {})), data.get('worker', '')))
    
    conn.commit()
    conn.close()
    
    print("Check saved successfully")
    return jsonify({'success': True})

@app.route('/api/records/<int:checksheet_id>')
def get_records(checksheet_id):
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('SELECT order_number, checked, checked_at, hotspot_check_states, worker FROM check_records WHERE checksheet_id = ? ORDER BY checked_at DESC', (checksheet_id,))
    records = cursor.fetchall()
    conn.close()
    
    records_dict = {}
    for record in records:
        order_number = record[0]
        if order_number is None:
            continue
        checked = record[1]
        hotspot_check_states = json.loads(record[3]) if record[3] else {}
        worker = record[4] if len(record) > 4 else ''
        # 発注番号ごとの最新の記録のみを保存
        if order_number not in records_dict:
            records_dict[order_number] = {
                'checked': checked,
                'hotspot_check_states': hotspot_check_states,
                'worker': worker
            }
    
    return jsonify({'records': records_dict})

@app.route('/records')
def records_page():
    return render_template('records.html')

@app.route('/api/all-records')
def get_all_records():
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, order_number, hotspots FROM checksheets ORDER BY order_number, id')
    checksheets = cursor.fetchall()
    
    result = {}
    for checksheet in checksheets:
        checksheet_id, name, order_number, hotspots_json = checksheet
        hotspots = json.loads(hotspots_json) if hotspots_json else []
        
        # すべてのチェック記録を取得
        cursor.execute('SELECT id, order_number, checked, checked_at, hotspot_check_states, worker FROM check_records WHERE checksheet_id = ? ORDER BY checked_at DESC', (checksheet_id,))
        check_records = cursor.fetchall()
        
        result[checksheet_id] = {
            'name': name,
            'order_number': order_number,
            'records': []
        }
        
        # すべての記録を追加
        for r in check_records:
            result[checksheet_id]['records'].append({
                'id': r[0],
                'order_number': r[1],
                'checked': bool(r[2]),
                'checked_at': r[3],
                'hotspot_check_states': json.loads(r[4]) if r[4] else {},
                'worker': r[5] if len(r) > 5 else ''
            })
    
    conn.close()
    return jsonify({'records': result})

@app.route('/api/record', methods=['DELETE'])
def delete_record():
    data = request.get_json()
    print(f"Delete request data: {data}")
    record_id = int(data.get('record_id'))
    print(f"Deleting record: record_id={record_id}")
    
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('DELETE FROM check_records WHERE id = ?', (record_id,))
    deleted_rows = cursor.rowcount
    print(f"Deleted rows: {deleted_rows}")
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'deleted_rows': deleted_rows})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/checksheets')
def get_checksheets():
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM checksheets ORDER BY created_at DESC')
    checksheets = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'checksheets': [
            {
                'id': cs[0],
                'name': cs[1],
                'image_path': cs[2],
                'created_at': cs[4]
            }
            for cs in checksheets
        ]
    })

@app.route('/api/export', methods=['POST'])
def export_to_sheets():
    data = request.json
    checksheet_id = data.get('checksheet_id')
    
    try:
        # チェチEシート情報を取征E
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM checksheets WHERE id = ?', (checksheet_id,))
        checksheet = cursor.fetchone()
        
        # チェチE記録を取征E
        cursor.execute('SELECT * FROM check_records WHERE checksheet_id = ?', (checksheet_id,))
        records = cursor.fetchall()
        conn.close()
        
        if not checksheet:
            return jsonify({'success': False, 'error': 'Checksheet not found'})
        
        # CSV形式でチEEタを準備
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # ヘッダー
        writer.writerow(['チェックシート名', checksheet[1]])
        if len(checksheet) > 4 and checksheet[4]:
            writer.writerow(['発注番号', checksheet[4]])
        writer.writerow(['作成日時', checksheet[4] if len(checksheet) <= 4 else checksheet[5]])
        writer.writerow([])
        writer.writerow(['吹き出し番号', 'チェック項目', 'チェック状態', 'チェック日時'])
        
        hotspots = json.loads(checksheet[3])
        records_dict = {r[2]: r for r in records}
        
        for idx, hotspot in enumerate(hotspots, 1):
            record = records_dict.get(hotspot['id'])
            checked = '済' if record and record[3] else '未'
            checked_at = record[4] if record else ''
            writer.writerow([idx, hotspot['text'], checked, checked_at])
        
        csv_content = output.getvalue()
        
        # Google Sheets APIを使用する場合E実裁EE
        # 実際にはOAuth認証が忁EでぁE
        # ここではCSVダウンロードとして提侁E
        return jsonify({
            'success': True,
            'csv_data': csv_content,
            'message': 'CSVとしてダウンロードしました'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/checksheet/<int:id>', methods=['DELETE'])
def delete_checksheet(id):
    try:
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        
        # チェチEシート情報を取得（画像削除用EE
        cursor.execute('SELECT image_path FROM checksheets WHERE id = ?', (id,))
        checksheet = cursor.fetchone()
        
        if not checksheet:
            conn.close()
            return jsonify({'success': False, 'error': 'Checksheet not found'})
        
        # チェチE記録を削除
        cursor.execute('DELETE FROM check_records WHERE checksheet_id = ?', (id,))
        
        # チェチEシートを削除
        cursor.execute('DELETE FROM checksheets WHERE id = ?', (id,))
        
        conn.commit()
        conn.close()
        
        # 画像ファイルを削除
        image_path = checksheet[0]
        if os.path.exists(image_path):
            os.remove(image_path)
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
