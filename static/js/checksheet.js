let hotspots = [...initialHotspots];
let isAddMode = false;
let isEditMode = true;
let nextHotspotId = hotspots.length > 0 ? Math.max(...hotspots.map(h => h.id)) + 1 : 1;
let checkRecords = {};
let orderNumber = initialOrderNumber || '';
let worker = initialWorker || '';
let hotspotCheckStates = {};

const imageContainer = document.getElementById('image-container');
const image = document.getElementById('checksheet-image');
const hotspotsLayer = document.getElementById('hotspots-layer');
const addHotspotBtn = document.getElementById('add-hotspot-btn');
const saveBtn = document.getElementById('save-btn');
const hotspotList = document.getElementById('hotspot-list');
const orderNumberInput = document.getElementById('order-number-input');
const workerInput = document.getElementById('worker-input');
const toggleModeBtn = document.getElementById('toggle-mode-btn');

// チェック記録を取得
async function loadCheckRecords() {
    try {
        const response = await fetch(`/api/records/${checksheetId}`);
        const data = await response.json();
        checkRecords = {};
        if (data.records) {
            Object.entries(data.records).forEach(([orderNumber, record]) => {
                checkRecords[orderNumber] = record;
            });
        }
        // 現在の発注番号のチェック状態を読み込む
        loadOrderNumberCheckStates();
    } catch (error) {
        console.error('Error loading check records:', error);
    }
}

// 発注番号のチェック状態を読み込む
function loadOrderNumberCheckStates() {
    if (!orderNumber || !checkRecords[orderNumber]) {
        // 発注番号がない、または記録がない場合はチェック状態を初期化
        hotspots.forEach(hotspot => {
            if (hotspotCheckStates[hotspot.id] === undefined) {
                hotspotCheckStates[hotspot.id] = false;
            }
        });
        // 作業者も初期化
        if (workerInput) {
            workerInput.value = worker;
        }
    } else {
        // 発注番号の記録がある場合はチェック状態を読み込む
        const record = checkRecords[orderNumber];
        if (record.hotspot_check_states) {
            hotspotCheckStates = {...record.hotspot_check_states};
        } else {
            hotspots.forEach(hotspot => {
                hotspotCheckStates[hotspot.id] = false;
            });
        }
        // 作業者も読み込む
        if (record.worker !== undefined && workerInput) {
            worker = record.worker;
            workerInput.value = worker;
        }
    }
    renderHotspots();
}

// ホットスポットを取得
async function loadHotspots() {
    try {
        const response = await fetch(`/api/hotspots?checksheet_id=${checksheetId}`);
        const data = await response.json();
        console.log('Hotspots data:', data);
        if (data.success && data.hotspots) {
            hotspots = data.hotspots;
            nextHotspotId = hotspots.length > 0 ? Math.max(...hotspots.map(h => h.id)) + 1 : 1;
            console.log('Loaded hotspots:', hotspots);
        } else {
            console.log('No hotspots found or error:', data.error);
        }
    } catch (error) {
        console.error('Error loading hotspots:', error);
    }
    renderHotspots();
}

// ホットスポットを描画
function renderHotspots() {
    hotspotsLayer.innerHTML = '';
    hotspotList.innerHTML = '';
    
    console.log('Rendering hotspots, count:', hotspots.length);
    
    hotspots.forEach((hotspot, index) => {
        console.log(`Hotspot ${index}:`, hotspot);
        
        // 画像上のホットスポット
        const hotspotEl = document.createElement('div');
        hotspotEl.className = 'hotspot';
        if (hotspotCheckStates[hotspot.id]) {
            hotspotEl.classList.add('checked');
        }
        hotspotEl.style.left = `${hotspot.x}%`;
        hotspotEl.style.top = `${hotspot.y}%`;
        
        // チェックボックスを追加
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'hotspot-checkbox';
        checkbox.checked = hotspotCheckStates[hotspot.id] || false;
        checkbox.dataset.hotspotId = hotspot.id;
        
        // チェックボックスの位置を設定
        const checkboxX = hotspot.checkbox_x !== undefined ? hotspot.checkbox_x : 50;
        const checkboxY = hotspot.checkbox_y !== undefined ? hotspot.checkbox_y : 50;
        checkbox.style.left = `${checkboxX}%`;
        checkbox.style.top = `${checkboxY}%`;
        checkbox.style.transform = 'translate(-50%, -50%)';
        
        checkbox.addEventListener('click', (e) => {
            console.log('Checkbox clicked, isEditMode:', isEditMode, 'isAddMode:', isAddMode, 'hotspot_id:', hotspot.id);
            e.stopPropagation();
            if (isEditMode && isAddMode) {
                editHotspot(hotspot);
            } else if (!isEditMode) {
                toggleHotspotCheck(hotspot.id);
            }
        });
        
        hotspotEl.appendChild(checkbox);
        
        // 番号表示
        const number = document.createElement('span');
        number.className = 'hotspot-number';
        number.textContent = index + 1;
        hotspotEl.appendChild(number);
        
        hotspotEl.dataset.id = hotspot.id;
        
        // 編集モードでホットスポットをドラッグして移動できるようにする
        if (isEditMode) {
            hotspotEl.addEventListener('mousedown', (e) => {
                if (e.target === checkbox) return; // チェックボックスの場合は無視
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const initialX = hotspot.x;
                const initialY = hotspot.y;
                const imageRect = image.getBoundingClientRect();
                
                const onMouseMove = (moveEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    
                    const newX = Math.max(0, Math.min(100, initialX + (deltaX / imageRect.width) * 100));
                    const newY = Math.max(0, Math.min(100, initialY + (deltaY / imageRect.height) * 100));
                    
                    hotspotEl.style.left = `${newX}%`;
                    hotspotEl.style.top = `${newY}%`;
                    
                    hotspot.x = newX;
                    hotspot.y = newY;
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    saveHotspots();
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
        
        hotspotsLayer.appendChild(hotspotEl);
        
        // ホットスポットリスト
        const listItem = document.createElement('div');
        listItem.className = 'hotspot-item';
        const deleteButton = isEditMode ? `<button class="delete-btn" onclick="deleteHotspot(${hotspot.id})">削除</button>` : '';
        
        // チェックボックスをリストにも追加
        const listCheckbox = document.createElement('input');
        listCheckbox.type = 'checkbox';
        listCheckbox.className = 'list-checkbox';
        listCheckbox.checked = hotspotCheckStates[hotspot.id] || false;
        listCheckbox.disabled = isEditMode; // 編集モードでは無効化
        listCheckbox.addEventListener('change', (e) => {
            if (!isEditMode) {
                toggleHotspotCheck(hotspot.id);
            }
        });
        
        listItem.appendChild(listCheckbox);
        listItem.innerHTML += `
            <div class="number">${index + 1}</div>
            <div class="text">${escapeHtml(hotspot.text)}</div>
            ${deleteButton}
        `;
        hotspotList.appendChild(listItem);
    });
}

// モード切替
toggleModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    toggleModeBtn.textContent = isEditMode ? '編集モード' : 'チェックモード';
    toggleModeBtn.classList.toggle('btn-primary', isEditMode);
    toggleModeBtn.classList.toggle('btn-info', !isEditMode);
    addHotspotBtn.style.display = isEditMode ? 'inline-block' : 'none';
    image.style.cursor = isEditMode && isAddMode ? 'crosshair' : 'default';
    renderHotspots();
});

// ホットスポット追加モード切替
addHotspotBtn.addEventListener('click', () => {
    isAddMode = !isAddMode;
    addHotspotBtn.textContent = isAddMode ? '追加モード: ON' : '吹き出し追加';
    addHotspotBtn.classList.toggle('btn-success', isAddMode);
    addHotspotBtn.classList.toggle('btn-primary', !isAddMode);
    image.style.cursor = isAddMode ? 'crosshair' : 'default';
});

// 画像クリックでホットスポット追加
image.addEventListener('click', (e) => {
    if (!isEditMode || !isAddMode) return;
    
    const rect = image.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const text = prompt('吹き出しのテキストを入力:');
    if (text) {
        hotspots.push({
            id: nextHotspotId++,
            x: x,
            y: y,
            text: text,
            checkbox_x: 50,
            checkbox_y: 50
        });
        renderHotspots();
    }
});

// ホットスポット編集
function editHotspot(hotspot) {
    const newText = prompt('吹き出しのテキストを編集:', hotspot.text);
    if (newText !== null) {
        hotspot.text = newText;
        renderHotspots();
    }
}

// ホットスポット削除
function deleteHotspot(id) {
    if (!isEditMode) return;
    if (confirm('この吹き出しを削除しますか？')) {
        hotspots = hotspots.filter(h => h.id !== id);
        renderHotspots();
    }
}

// チェック切替
function toggleCheck(orderNumber) {
    console.log('toggleCheck called with orderNumber:', orderNumber);
    if (!orderNumber) {
        alert('発注番号が入力されていません。発注番号を入力してください。');
        return;
    }
    
    checkRecords[orderNumber] = !checkRecords[orderNumber];
    console.log('checkRecords after toggle:', checkRecords);
    renderHotspots();
}

// ホットスポットチェック切替
function toggleHotspotCheck(hotspotId) {
    console.log('toggleHotspotCheck called with hotspotId:', hotspotId);
    hotspotCheckStates[hotspotId] = !hotspotCheckStates[hotspotId];
    console.log('hotspotCheckStates after toggle:', hotspotCheckStates);
    renderHotspots();
}

// 保存
saveBtn.addEventListener('click', async () => {
    console.log('Save button clicked');
    console.log('hotspotCheckStates:', hotspotCheckStates);
    
    // 発注番号がない場合は保存を許可しない
    if (!orderNumber) {
        alert('発注番号が入力されていません。発注番号を入力してください。');
        return;
    }
    
    // すべてのホットスポットがチェックされているか確認
    const allChecked = hotspots.every(hotspot => hotspotCheckStates[hotspot.id]);
    
    if (!allChecked) {
        alert('すべてのホットスポットにチェックを入れてください。');
        return;
    }
    
    try {
        // ホットスポットを保存
        const response = await fetch('/api/hotspots', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                checksheet_id: checksheetId,
                hotspots: hotspots
            })
        });
        
        const data = await response.json();
        console.log('Hotspots saved:', data);
        
        if (!data.success) {
            alert('ホットスポットの保存に失敗しました');
            return;
        }
        
        // チェック記録を保存（発注番号ごとに別々の記録）
        console.log('Saving check record...');
        await fetch('/api/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                checksheet_id: checksheetId,
                order_number: orderNumber,
                checked: true,
                hotspot_check_states: hotspotCheckStates,
                worker: worker
            })
        });
        
        alert('保存しました');
    } catch (error) {
        console.error('Error saving:', error);
        alert('エラーが発生しました');
    }
});

// 発注番号入力時のイベント
orderNumberInput.addEventListener('input', (e) => {
    const newOrderNumber = e.target.value;
    if (newOrderNumber !== orderNumber) {
        orderNumber = newOrderNumber;
        // 発注番号が変更されたとき、チェック状態をリセット
        hotspotCheckStates = {};
        hotspots.forEach(hotspot => {
            hotspotCheckStates[hotspot.id] = false;
        });
        renderHotspots();
    }
});

// 作業者入力時のイベント
workerInput.addEventListener('input', (e) => {
    worker = e.target.value;
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初期化
loadCheckRecords();
loadHotspots();
