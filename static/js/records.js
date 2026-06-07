const orderNumberFilter = document.getElementById('order-number-filter');
const filterBtn = document.getElementById('filter-btn');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const recordsList = document.getElementById('records-list');

let allRecords = {};

// 全記録を取得
async function loadAllRecords() {
    try {
        const response = await fetch('/api/all-records');
        const data = await response.json();
        allRecords = data.records || {};
        displayRecords(allRecords);
    } catch (error) {
        console.error('Error loading records:', error);
        recordsList.innerHTML = '<p>エラーが発生しました。</p>';
    }
}

// 記録を表示
function displayRecords(records) {
    const entries = Object.entries(records);
    
    if (entries.length === 0) {
        recordsList.innerHTML = '<p>記録がありません。</p>';
        return;
    }
    
    recordsList.innerHTML = entries.map(([checksheetId, data]) => {
        const recordsArray = data.records || [];
        const tableContent = recordsArray.length > 0 ? `
            <table class="records-table">
                <thead>
                    <tr>
                        <th>発注番号</th>
                        <th>作業者</th>
                        <th>状態</th>
                        <th>チェック日時</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${recordsArray.map(r => `
                        <tr>
                            <td>${escapeHtml(r.order_number || '-')}</td>
                            <td>${escapeHtml(r.worker || '-')}</td>
                            <td>${r.checked ? '✓ 済' : '未'}</td>
                            <td>${r.checked ? (r.checked_at ? new Date(r.checked_at).toLocaleString('ja-JP') : '-') : '-'}</td>
                            <td><button class="btn btn-small btn-danger delete-record" data-record-id="${r.id}" data-checksheet-id="${checksheetId}">削除</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>チェック項目がありません。</p>';
        
        return `
            <div class="checksheet-records">
                <h3>${escapeHtml(data.name)} ${data.order_number ? `(発注番号: ${escapeHtml(data.order_number)})` : ''}</h3>
                <a href="/checksheet/${checksheetId}" class="btn btn-small btn-secondary">チェックシートを開く</a>
                ${tableContent}
            </div>
        `;
    }).join('');
}

// 絞り込み
filterBtn.addEventListener('click', () => {
    const filter = orderNumberFilter.value.trim();
    if (!filter) {
        displayRecords(allRecords);
        return;
    }
    
    const filtered = {};
    Object.entries(allRecords).forEach(([checksheetId, data]) => {
        const recordsArray = data.records || [];
        const filteredRecords = recordsArray.filter(r => r.order_number && r.order_number.includes(filter));
        
        if (filteredRecords.length > 0) {
            filtered[checksheetId] = {
                ...data,
                records: filteredRecords
            };
        }
    });
    
    displayRecords(filtered);
});

// Enterキーで絞り込み
orderNumberFilter.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        filterBtn.click();
    }
});

// クリア
clearFilterBtn.addEventListener('click', () => {
    orderNumberFilter.value = '';
    displayRecords(allRecords);
});

// エスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初期化
loadAllRecords();

// 記録削除
document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-record');
    if (deleteBtn) {
        e.preventDefault();
        const recordId = deleteBtn.dataset.recordId;
        const checksheetId = deleteBtn.dataset.checksheetId;
        console.log('Delete button clicked:', { recordId, checksheetId });
        
        if (confirm('この記録を削除しますか？')) {
            try {
                const requestBody = {
                    record_id: recordId
                };
                console.log('Sending delete request:', requestBody);
                
                const response = await fetch('/api/record', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                const data = await response.json();
                console.log('Delete response:', data);
                
                if (data.success) {
                    loadAllRecords();
                } else {
                    alert('削除に失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                console.error('Error deleting record:', error);
                alert('エラーが発生しました');
            }
        }
    }
});
