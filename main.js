document.getElementById('convertBtn').addEventListener('click', async () => {
    const urlInput = document.getElementById('urlInput');
    const status = document.getElementById('status');
    const convertBtn = document.getElementById('convertBtn');
    const url = urlInput.value.trim();

    if (!url) {
        status.innerHTML = '<span class="error">유튜브 링크를 입력해 주세요.</span>';
        return;
    }

    status.innerHTML = '<span class="loading">변환 중입니다. 잠시만 기다려 주세요...</span>';
    convertBtn.disabled = true;

    try {
        // 서버에 변환 요청 (이제 JSON 응답을 받습니다)
        const response = await fetch(`/download?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.success && data.link) {
            status.innerHTML = '변환 성공! 다운로드가 시작됩니다.';
            
            // 새 창에서 다운로드 링크 열기 (가장 확실한 방법)
            const a = document.createElement('a');
            a.href = data.link;
            a.download = data.title || 'audio.mp3';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            convertBtn.disabled = false;
        } else {
            status.innerHTML = `<span class="error">오류: ${data.message || '변환에 실패했습니다.'}</span>`;
            convertBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        status.innerHTML = '<span class="error">서버와 통신 중 오류가 발생했습니다.</span>';
        convertBtn.disabled = false;
    }
});
