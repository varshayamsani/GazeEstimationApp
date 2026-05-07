(() => {
  const captureStatus = document.getElementById("captureStatus");
  const participantId = document.body?.dataset?.participantId || "";
  const csrfToken = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((entry) => entry.startsWith("csrftoken="))
    ?.split("=")[1];

  const sessionStamp = Date.now();
  const activeRecorders = [];
  const pendingUploads = new Set();
  const pendingFinalizations = [];
  let stoppedAll = false;
  const controlChannel = "BroadcastChannel" in window ? new BroadcastChannel("survey-capture-control") : null;
  let openerWatchTimer = null;
  let openerClosedChecks = 0;
  let heartbeatWatchTimer = null;
  let lastHeartbeatAt = Date.now();
  const activeStreams = [];

  const setStatus = (message, isError = false) => {
    if (!captureStatus) {
      return;
    }
    captureStatus.textContent = message;
    captureStatus.style.color = isError ? "#b42318" : "#0e7a58";
  };

  const uploadClipChunk = async (blob, endpoint, filenamePrefix) => {
    const formData = new FormData();
    formData.append("clip", blob, `${filenamePrefix}-${sessionStamp}.webm`);
    formData.append("session_stamp", String(sessionStamp));
    formData.append("participant_id", participantId);
    formData.append("csrfmiddlewaretoken", csrfToken || "");
    const uploadPromise = fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": csrfToken,
        },
      })
      .catch((err) => {
        console.error(`Failed to upload clip chunk to ${endpoint}`, err);
      })
      .finally(() => {
        pendingUploads.delete(uploadPromise);
      });
    pendingUploads.add(uploadPromise);
    await uploadPromise;
  };

  const finalizeClip = async (endpoint) => {
    if (pendingUploads.size > 0) {
      await Promise.allSettled(Array.from(pendingUploads));
    }

    const formData = new FormData();
    formData.append("session_stamp", String(sessionStamp));
    formData.append("participant_id", participantId);
    formData.append("csrfmiddlewaretoken", csrfToken || "");

    let sent = false;
    try {
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon(endpoint, formData);
      }
    } catch (err) {
      sent = false;
    }

    if (!sent) {
      await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": csrfToken,
        },
        keepalive: true,
      }).catch(() => {
        console.warn(`Could not finalize recording at ${endpoint}`);
      });
    }
  };

  const startRecorder = (stream, endpoint, finalizeEndpoint, filenamePrefix) => {
    if (typeof MediaRecorder === "undefined") {
      return null;
    }

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream);
      } catch (innerErr) {
        console.error(`Could not start MediaRecorder for ${endpoint}`, innerErr);
        return null;
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        uploadClipChunk(event.data, endpoint, filenamePrefix);
      }
    };
    recorder.onstop = () => {
      const finalizePromise = finalizeClip(finalizeEndpoint).finally(() => {
        const idx = pendingFinalizations.indexOf(finalizePromise);
        if (idx >= 0) {
          pendingFinalizations.splice(idx, 1);
        }
      });
      pendingFinalizations.push(finalizePromise);
    };
    recorder.start(3000);
    activeRecorders.push(recorder);
    activeStreams.push(stream);
    return recorder;
  };

  const stopAllRecorders = async () => {
    if (stoppedAll) {
      return;
    }
    stoppedAll = true;
    activeRecorders.forEach((recorder) => {
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.requestData();
        } catch (err) {}
        recorder.stop();
      }
    });
    activeStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {}
      });
    });

    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (pendingFinalizations.length > 0) {
      await Promise.allSettled([...pendingFinalizations]);
    }
  };

  const handleStopMessage = async (payload) => {
    if (payload?.type === "stop-capture-session") {
      setStatus("Finalizing recordings...");
      await stopAllRecorders();
      if (openerWatchTimer) {
        window.clearInterval(openerWatchTimer);
      }
      window.close();
    }
  };

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    void handleStopMessage(event.data);
  });

  if (controlChannel) {
    controlChannel.addEventListener("message", (event) => {
      if (event.data?.type === "survey-heartbeat") {
        lastHeartbeatAt = Date.now();
        return;
      }
      void handleStopMessage(event.data);
    });
  }

  window.addEventListener("beforeunload", () => {
    void stopAllRecorders();
  });
  window.addEventListener("pagehide", () => {
    void stopAllRecorders();
  });

  if (window.opener) {
    openerWatchTimer = window.setInterval(() => {
      if (window.opener.closed) {
        openerClosedChecks += 1;
      } else {
        openerClosedChecks = 0;
      }
      if (openerClosedChecks >= 5) {
        stopAllRecorders();
        window.close();
      }
    }, 1000);
  }

  if (controlChannel) {
    heartbeatWatchTimer = window.setInterval(() => {
      if (Date.now() - lastHeartbeatAt < 4500) {
        return;
      }
      void stopAllRecorders().finally(() => {
        if (openerWatchTimer) {
          window.clearInterval(openerWatchTimer);
        }
        if (heartbeatWatchTimer) {
          window.clearInterval(heartbeatWatchTimer);
        }
        window.close();
      });
    }, 1000);
  }

  const normalizeError = (err) => {
    if (!err) {
      return "unknown-error";
    }
    return err.name || err.message || String(err);
  };

  const getPreferredWebcamConstraints = async () => {
    const fallbackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };

    if (!navigator.mediaDevices?.enumerateDevices) {
      return fallbackConstraints;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      if (videoInputs.length === 0) {
        return fallbackConstraints;
      }

      const preferredDevice =
        videoInputs.find((device) => /external|usb|logi|webcam|camera/i.test(device.label)) ||
        videoInputs[0];

      const constraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      if (preferredDevice.deviceId) {
        constraints.deviceId = { ideal: preferredDevice.deviceId };
      }

      return constraints;
    } catch (err) {
      console.warn("Could not enumerate video devices", err);
      return fallbackConstraints;
    }
  };

  const startCaptureSession = async () => {
    if (!window.isSecureContext) {
      setStatus(
        "Recording is unavailable on this address. Open the survey on localhost or HTTPS to allow screen and webcam access.",
        true,
      );
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices?.getUserMedia) {
      setStatus(
        "This browser context does not support the required media APIs. Open the survey on localhost or HTTPS in a current browser.",
        true,
      );
      return;
    }

    const errors = [];
    let screenStream = null;
    let webcamStream = null;

    try {
      setStatus("Requesting screen-sharing access...");
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          selfBrowserSurface: "exclude",
          surfaceSwitching: "exclude",
          monitorTypeSurfaces: "include",
          preferCurrentTab: false,
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false,
      });
    } catch (err) {
      errors.push(`screen: ${normalizeError(err)}`);
      console.warn("Screen capture was not started", err);
    }

    try {
      setStatus(screenStream ? "Screen sharing approved. Requesting webcam access..." : "Requesting webcam access...");
      const webcamConstraints = await getPreferredWebcamConstraints();
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: webcamConstraints,
        audio: false,
      });
    } catch (err) {
      errors.push(`webcam: ${normalizeError(err)}`);
      console.warn("Webcam capture was not started", err);
    }

    if (!screenStream || !webcamStream) {
      [screenStream, webcamStream].filter(Boolean).forEach((stream) => {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (err) {}
        });
      });
      setStatus("Recording could not start. Allow both screen sharing and webcam access, then retry the survey.", true);
      if (errors.length > 0) {
        console.error("Capture session failed:", errors.join("; "));
      }
      return;
    }

    const screenRecorder = startRecorder(
      screenStream,
      "/api/screen/upload/",
      "/api/screen/finalize/",
      "screen-clip",
    );
    const webcamRecorder = startRecorder(
      webcamStream,
      "/api/webcam/upload/",
      "/api/webcam/finalize/",
      "webcam-clip",
    );

    if (!screenRecorder || !webcamRecorder) {
      stopAllRecorders();
      setStatus("Recording could not start. Your browser could not initialize both recorders.", true);
      return;
    }

    const syncStop = () => {
      stopAllRecorders();
    };

    screenStream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", syncStop);
    });
    webcamStream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", syncStop);
    });

    setStatus(`Recording is active for this survey session (screen + webcam, session ${sessionStamp}).`);
  };

  startCaptureSession();
})();
