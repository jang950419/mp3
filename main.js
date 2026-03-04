document.getElementById('convertBtn').addEventListener('click', async () => {
    const urlInput = document.getElementById('urlInput');
    const status = document.getElementById('status');
    const convertBtn = document.getElementById('convertBtn');
    const url = urlInput.value.trim();

    if (!url) {
        status.innerHTML = '<span class="error">유튜브 링크를 입력해 주세요.</span>';
        return;
    }

    if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
        status.innerHTML = '<span class="error">올바른 유튜브 링크가 아닙니다.</span>';
        return;
    }

    status.innerHTML = '<span class="loading">변환 중입니다. 잠시만 기다려 주세요...</span>';
    convertBtn.disabled = true;

    try {
        // 서버에 다운로드 요청
        // window.location.href를 사용하면 브라우저가 직접 파일 다운로드를 처리합니다.
        window.location.href = `/download?url=${encodeURIComponent(url)}`;
        
        status.innerHTML = '다운로드가 시작되었습니다.';
        convertBtn.disabled = false;
    } catch (err) {
        status.innerHTML = '<span class="error">변환 중 오류가 발생했습니다.</span>';
        convertBtn.disabled = false;
    }
});
