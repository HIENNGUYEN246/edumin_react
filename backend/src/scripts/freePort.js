import { execSync } from 'child_process';

const port = process.argv[2] || process.env.PORT || 4000;
console.log(`[Free-Port] Đang kiểm tra tiến trình đang sử dụng cổng ${port}...`);

try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const lines = output.split('\n');
  let killed = false;
  const seenPids = new Set();
  for (const line of lines) {
    if (
      line.includes('LISTENING') ||
      line.includes('FIN_WAIT') ||
      line.includes('CLOSE_WAIT') ||
      line.includes('TIME_WAIT')
    ) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && Number(pid) > 0 && Number(pid) !== process.pid && !seenPids.has(pid)) {
        seenPids.add(pid);
        console.log(`[Free-Port] Tìm thấy tiến trình PID ${pid} đang chiếm cổng ${port}. Đang buộc dừng...`);
        try {
          execSync(`taskkill /F /T /PID ${pid}`);
          console.log(`[Free-Port] ✅ Đã giải phóng cổng ${port} (PID: ${pid}) thành công!`);
          killed = true;
        } catch (err) {
          console.error(`[Free-Port] ❌ Không thể dừng PID ${pid} do không đủ quyền (Access Denied / Administrator).`);
          console.log(`[Free-Port] 👉 Hướng dẫn xử lý:`);
          console.log(`   1. Mở Task Manager (Ctrl + Shift + Esc), tìm node.exe (PID ${pid}) và chọn End Task.`);
          console.log(`   2. Hoặc mở CMD / PowerShell (Run as Administrator) và gõ: taskkill /F /PID ${pid}`);
          console.log(`   3. Hoặc nhấp chuột phải file "kill_port_4000.bat" ở thư mục gốc chọn "Run as administrator".`);
        }
      }
    }
  }
  if (!killed) {
    console.log(`[Free-Port] Cổng ${port} hiện đang trống và sẵn sàng.`);
  }
} catch (e) {
  console.log(`[Free-Port] Cổng ${port} hiện đang trống và sẵn sàng.`);
}

