export function createHud({ video, body, switchButton }){
  let stream = null;
  let enabled = false;
  let devices = [];
  let deviceIndex = 0;

  async function refreshDevices(){
    try{
      const list = await navigator.mediaDevices.enumerateDevices();
      devices = list.filter(d => d.kind === "videoinput");
      if (deviceIndex >= devices.length) deviceIndex = 0;
      if (switchButton) switchButton.disabled = devices.length < 2;
    } catch {
      devices = [];
      if (switchButton) switchButton.disabled = true;
    }
  }

  async function enable(){
    if (enabled) return true;
    try{
      await refreshDevices();
      const deviceId = devices[deviceIndex]?.deviceId;
      const constraints = deviceId ? { video: { deviceId: { exact: deviceId } }, audio: false } : { video: true, audio: false };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();
      body.classList.add("hud-on");
      enabled = true;
      await refreshDevices();
      return true;
    } catch (err){
      console.warn("HUD camera error", err);
      return false;
    }
  }

  function disable(){
    if (!enabled) return;
    body.classList.remove("hud-on");
    enabled = false;
    if (stream){
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  async function switchCamera(){
    if (!enabled) return;
    await refreshDevices();
    if (devices.length < 2) return;
    deviceIndex = (deviceIndex + 1) % devices.length;
    disable();
    await enable();
  }

  async function toggle(){
    if (enabled) {
      disable();
      return;
    }
    await enable();
  }

  if (switchButton){
    switchButton.addEventListener("click", (e) => {
      e.stopPropagation();
      switchCamera();
    });
  }

  return { enable, disable, toggle, switchCamera };
}
