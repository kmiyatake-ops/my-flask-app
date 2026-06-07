// 画像プレビュー
document.getElementById('image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー">`;
        };
        reader.readAsDataURL(file);
    }
});

// フォーム送信
document.getElementById('create-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    
    try {
        const response = await fetch('/create', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = `/checksheet/${data.id}`;
        } else {
            alert('作成に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました');
    }
});
