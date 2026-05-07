(() => {
  const carousel = document.getElementById("movieCarousel");
  const carouselViewport = document.getElementById("carouselViewport");
  const starRating = document.getElementById("starRating");
  const ratingValue = document.getElementById("ratingValue");
  const ratingChoiceInput = document.getElementById("ratingChoiceInput");
  const endStudyBtn = document.querySelector(".end-study-btn");
  const thankYouUrl = "/thank-you/";
  const isThankYouPage = window.location.pathname === thankYouUrl;
  const searchParams = new URLSearchParams(window.location.search);
  const shouldStartCapture = searchParams.get("start_capture") === "1";
  const controlChannel = "BroadcastChannel" in window ? new BroadcastChannel("survey-capture-control") : null;
  let heartbeatTimer = null;
  let autoScrollTimer = null;
  let isAnimating = false;
  let selectedRating = Number.parseFloat(ratingChoiceInput?.value || "0") || 0;

  const activateCenterCard = () => {
    if (!carousel) {
      return;
    }
    const all = Array.from(carousel.querySelectorAll(".movie-card"));
    if (all.length === 0) {
      return;
    }

    const viewportRect = (carouselViewport || carousel).getBoundingClientRect();
    const viewportCenterX = viewportRect.left + viewportRect.width / 2;

    let bestCard = all[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    all.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenterX - viewportCenterX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCard = card;
      }
    });

    all.forEach((card) => card.classList.remove("active-card"));
    bestCard.classList.add("active-card");
  };

  const startAutoCarousel = () => {
    if (!carousel || carousel.children.length === 0) {
      return;
    }

    const styles = window.getComputedStyle(carousel);
    const parsedGap = parseFloat(styles.columnGap || styles.gap || "0");
    const gap = Number.isFinite(parsedGap) ? parsedGap : 0;

    const getStepPx = () => {
      const first = carousel.firstElementChild;
      if (!first) {
        return 0;
      }
      return first.getBoundingClientRect().width + gap;
    };

    activateCenterCard();
    autoScrollTimer = window.setInterval(() => {
      if (isAnimating) {
        return;
      }
      const first = carousel.firstElementChild;
      const stepPx = getStepPx();
      if (!first || stepPx <= 0) {
        return;
      }

      isAnimating = true;
      carousel.style.transition = "transform 0.65s ease";
      carousel.style.transform = `translate3d(-${stepPx}px, 0, 0)`;

      window.setTimeout(() => {
        carousel.appendChild(first);
        carousel.style.transition = "none";
        carousel.style.transform = "translate3d(0, 0, 0)";
        void carousel.offsetHeight;
        activateCenterCard();
        isAnimating = false;
      }, 650);
    }, 1700);

    window.addEventListener("resize", activateCenterCard);
  };

  const updateStarHighlight = () => {
    if (!starRating) {
      return;
    }
    starRating.querySelectorAll(".star").forEach((star, idx) => {
      const starValue = idx + 1;
      star.classList.remove("half", "full");
      if (selectedRating >= starValue) {
        star.classList.add("full");
      } else if (selectedRating >= starValue - 0.5) {
        star.classList.add("half");
      }
    });
    if (ratingValue) {
      ratingValue.textContent = `${selectedRating.toFixed(1)} / 5.0`;
    }
    if (ratingChoiceInput) {
      ratingChoiceInput.value = selectedRating > 0 ? selectedRating.toFixed(1) : "";
    }
  };

  const buildStarRating = () => {
    if (!starRating) {
      return;
    }
    starRating.innerHTML = "";
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement("div");
      star.className = "star";

      const icon = document.createElement("span");
      icon.className = "star-icon";
      icon.textContent = "★";
      star.appendChild(icon);

      const leftHalf = document.createElement("button");
      leftHalf.type = "button";
      leftHalf.className = "star-hit left";
      leftHalf.title = `${(i - 0.5).toFixed(1)} stars`;
      leftHalf.addEventListener("click", () => {
        selectedRating = i - 0.5;
        updateStarHighlight();
      });

      const rightHalf = document.createElement("button");
      rightHalf.type = "button";
      rightHalf.className = "star-hit right";
      rightHalf.title = `${i.toFixed(1)} stars`;
      rightHalf.addEventListener("click", () => {
        selectedRating = i;
        updateStarHighlight();
      });

      star.appendChild(leftHalf);
      star.appendChild(rightHalf);
      starRating.appendChild(star);
    }
    updateStarHighlight();
  };

  if (carousel) {
    carousel.addEventListener("click", (event) => {
      const card = event.target.closest(".movie-card, .article-card");
      if (!card || isAnimating) {
        return;
      }
      const detailUrl = card.dataset.detailUrl;
      if (detailUrl) {
        window.location.href = detailUrl;
      }
    });
  }

  if (shouldStartCapture && !sessionStorage.getItem("captureWindowStarted")) {
    const captureWindow = window.open(
      "/capture-session/",
      "surveyCaptureSession",
      "popup,width=460,height=340"
    );
    if (captureWindow) {
      sessionStorage.setItem("captureWindowStarted", "1");
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("start_capture");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  } else if (shouldStartCapture && sessionStorage.getItem("captureWindowStarted")) {
    const captureWindow = window.open(
      "/capture-session/",
      "surveyCaptureSession",
      "popup,width=460,height=340"
    );
    if (captureWindow) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("start_capture");
      window.history.replaceState({}, "", cleanUrl.toString());
    } else {
      sessionStorage.removeItem("captureWindowStarted");
    }
  }

  if (endStudyBtn) {
    endStudyBtn.addEventListener("click", () => {
      sessionStorage.removeItem("captureWindowStarted");
      if (controlChannel) {
        controlChannel.postMessage({ type: "stop-capture-session" });
      }
      window.location.href = thankYouUrl;
    });
  }

  if (controlChannel && (shouldStartCapture || sessionStorage.getItem("captureWindowStarted"))) {
    const sendHeartbeat = () => {
      controlChannel.postMessage({ type: "survey-heartbeat" });
    };

    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, 1000);

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    window.addEventListener("pagehide", stopHeartbeat);
    window.addEventListener("beforeunload", stopHeartbeat);
  }

  if (isThankYouPage && sessionStorage.getItem("captureWindowStarted")) {
    // The study completes by navigating directly to /thank-you/, so stop the
    // capture popup automatically and let it finalize pending uploads.
    window.setTimeout(() => {
      sessionStorage.removeItem("captureWindowStarted");
      if (controlChannel) {
        controlChannel.postMessage({ type: "stop-capture-session" });
      }
    }, 500);
  }

  buildStarRating();
  startAutoCarousel();
})();
