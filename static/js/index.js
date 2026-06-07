// チェックシート一覧を取得して表示
async function loadChecksheetList() {
    try {
        const response = await fetch('/api/checksheets');
        const data = await response.json();
        
        const listContent = document.getElementById('list-content');
        
        if (data.checksheets && data.checksheets.length > 0) {
            listContent.innerHTML = data.checksheets.map(cs => `
                <div class="checksheet-card">
                    <div class="card-content" onclick="location.href='/checksheet/${cs.id}'">
                        <h3>${escapeHtml(cs.name)}</h3>
                        <p>作成日: ${new Date(cs.created_at).toLocaleDateString('ja-JP')}</p>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteChecksheet(${cs.id}, '${escapeHtml(cs.name)}')">削除</button>
                </div>
            `).join('');
        } else {
            listContent.innerHTML = '<p>チェックシートがありません。新規作成してください。</p>';
        }
    } catch (error) {
        console.error('Error loading checksheet list:', error);
        document.getElementById('list-content').innerHTML = '<p>エラーが発生しました。</p>';
    }
}

// チェックシート削除
async function deleteChecksheet(id, name) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/checksheet/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('削除しました');
            loadChecksheetList();
        } else {
            alert('削除に失敗しました: ' + (data.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('Error deleting checksheet:', error);
        alert('エラーが発生しました');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', loadChecksheetList);
