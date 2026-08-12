// Main TikTok Downloader JavaScript Logic

document.addEventListener("DOMContentLoaded", () => {
  const tiktokForm = document.getElementById("tiktokForm");
  const tiktokUrlInput = document.getElementById("tiktokUrl");
  const btnAnalyze = document.getElementById("btnAnalyze");
  const btnSpinner = document.getElementById("btnSpinner");
  const btnText = document.getElementById("btnText");
  const btnPaste = document.getElementById("btnPaste");
  const btnClear = document.getElementById("btnClear");

  const skeletonLoading = document.getElementById("skeletonLoading");
  const resultContainer = document.getElementById("resultContainer");
  const resultHeaderSlot = document.getElementById("resultHeaderSlot");
  const mediaViewSlot = document.getElementById("mediaViewSlot");

  let currentAnalysisData = null;
  let activeSlideIndex = 0;

  // Custom Toast Notification Function
  window.showToast = function (message, type = "info", duration = 4000) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    const toastId = "toast_" + Date.now();
    let iconClass = "bi-info-circle-fill text-primary";
    let borderClass = "toast-info";

    if (type === "error") {
      iconClass = "bi-exclamation-triangle-fill text-danger";
      borderClass = "toast-error";
    } else if (type === "success") {
      iconClass = "bi-check-circle-fill text-success";
      borderClass = "toast-success";
    }

    const toastHtml = `
      <div id="${toastId}" class="custom-toast ${borderClass}" role="alert" aria-live="assertive" aria-atomic="true">
        <i class="bi ${iconClass} fs-5"></i>
        <div class="flex-grow-1 fs-7 fw-medium text-white">${message}</div>
        <button type="button" class="btn-close btn-close-white ms-2" onclick="document.getElementById('${toastId}').remove()"></button>
      </div>
    `;

    toastContainer.insertAdjacentHTML("beforeend", toastHtml);

    setTimeout(() => {
      const el = document.getElementById(toastId);
      if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateY(-10px)";
        el.style.transition = "all 0.3s ease";
        setTimeout(() => el.remove(), 300);
      }
    }, duration);
  };

  // Clipboard Paste handler
  if (btnPaste) {
    btnPaste.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            tiktokUrlInput.value = text.strip ? text.strip() : text.trim();
            showToast("Link berhasil ditempel dari clipboard!", "success");
          } else {
            showToast("Clipboard kosong.", "info");
          }
        } else {
          showToast(
            "Fitur clipboard tidak didukung di browser ini. Silakan tempel secara manual.",
            "info"
          );
        }
      } catch (err) {
        showToast(
          "Gagal membaca clipboard. Silakan tempel secara manual.",
          "info"
        );
      }
    });
  }

  // Clear Input handler
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      tiktokUrlInput.value = "";
      tiktokUrlInput.focus();
    });
  }

  // Submit / Analyze TikTok URL
  tiktokForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = tiktokUrlInput.value.trim();

    // Validations
    if (!url) {
      showToast(
        "Silakan tempelkan URL / link TikTok terlebih dahulu.",
        "error"
      );
      tiktokUrlInput.focus();
      return;
    }

    const tiktokRegex =
      /https?:\/\/(www\.|vt\.|vm\.|mobile\.)?tiktok\.com\/.+/i;
    if (!tiktokRegex.test(url)) {
      showToast(
        "Link tidak valid! Pastikan link dari TikTok (contoh: https://vt.tiktok.com/... atau https://www.tiktok.com/@user/video/...)",
        "error"
      );
      return;
    }

    // Set Loading state
    btnAnalyze.disabled = true;
    btnSpinner.classList.remove("d-none");
    btnText.textContent = " Menganalisis...";

    resultContainer.classList.add("d-none");
    skeletonLoading.classList.remove("d-none");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        showToast(
          data.message || "Gagal mengambil data TikTok. Coba lagi nanti.",
          "error"
        );
        skeletonLoading.classList.add("d-none");
        return;
      }

      // Success - Render Data
      currentAnalysisData = data;
      renderTikTokResult(data);
      showToast("Data TikTok berhasil dianalisis!", "success");
    } catch (err) {
      console.error(err);
      showToast(
        "Terjadi kesalahan koneksi server. Coba beberapa saat lagi.",
        "error"
      );
    } finally {
      btnAnalyze.disabled = false;
      btnSpinner.classList.add("d-none");
      btnText.innerHTML =
        '<i class="bi bi-lightning-charge-fill"></i> Analyze / Process';
      skeletonLoading.classList.add("d-none");
    }
  });

  // Format big numbers into short Indonesian-friendly notation (rb/jt)
  function formatCount(num) {
    const n = Number(num) || 0;
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, "") + " jt";
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + " rb";
    }
    return n.toString();
  }

  // Resolve a proxied, hotlink-safe image URL with our internal placeholder fallback
  function proxiedImageUrl(rawUrl, fallbackName) {
    if (rawUrl) {
      return `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
    }
    return placeholderSrc(fallbackName);
  }

  // Server-generated initials avatar/thumbnail placeholder (no external dependency)
  function placeholderSrc(name) {
    return `/api/placeholder-image?name=${encodeURIComponent(name || "TikTok")}`;
  }

  // Badge label + icon per content type
  function typeBadgeContent(data) {
    if (data.type === "video") {
      return '<i class="bi bi-film me-1"></i> TikTok Video';
    }
    if (data.type === "audio") {
      return '<i class="bi bi-music-note-beamed me-1"></i> TikTok Audio';
    }
    if (data.type === "slides") {
      return `<i class="bi bi-images me-1"></i> Slide Foto (${
        (data.slides || []).length
      })`;
    }
    return "";
  }

  // Build the two responsive copies of the type badge (desktop: right, mobile: below, left)
  function typeBadgeMarkup(data) {
    const label = typeBadgeContent(data);
    return `
      <span class="badge result-type-badge badge-desktop fs-7 px-3 py-2 rounded-pill">${label}</span>
      <span class="badge result-type-badge badge-mobile fs-7 px-3 py-2 rounded-pill">${label}</span>
    `;
  }

  // Build header card for Video / Slides: thumbnail left, info right
 function buildVideoSlidesHeader(data) {
   // Slides: gunakan foto slide pertama sebagai thumbnail; Video: gunakan cover
   const thumbRaw =
     data.type === "slides" && data.slides && data.slides.length
       ? data.slides[0]
       : data.cover;
   const thumbUrl = proxiedImageUrl(thumbRaw, data.title || "TikTok");
   const avatarUrl = proxiedImageUrl(data.author.avatar, data.author.nickname);
   const stats = data.stats || { views: 0, comments: 0, shares: 0 };

   // Ekstrak hashtag dan render title
   const hashtags = extractHashtags(data.title);
   const titleHtml = renderTitleWithToggle(data.title, hashtags);

   resultHeaderSlot.innerHTML = `
    <div class="card card-custom result-header-card p-3 p-md-4 mb-4 border-0 shadow-lg">
      <div class="result-header-body">
        <div class="result-thumb-box">
          <img src="${thumbUrl}" alt="Thumbnail" class="result-thumb-img" onerror="this.onerror=null;this.src='${placeholderSrc(
     data.title || "TikTok"
   )}';">
        </div>
        <div class="result-info-box">
          <div class="result-badge-wrapper">
            ${typeBadgeMarkup(data)}
          </div>
          <div class="result-title-row">
            <div class="result-post-title">${titleHtml}</div>
          </div>
          <div class="result-author-row">
            <img src="${avatarUrl}" alt="Avatar" class="result-avatar" onerror="this.onerror=null;this.src='${placeholderSrc(
     data.author.nickname
   )}';">
            <div class="result-author-text">
              <h6 class="result-nickname">${
                data.author.nickname || "TikTok User"
              }</h6>
              <span class="result-username">@${
                data.author.username || "tiktok"
              }</span>
            </div>
          </div>
          <div class="result-stats-row">
            <span class="result-stat-item"><i class="bi bi-play-fill"></i> ${formatCount(
              stats.views
            )}</span>
            <span class="result-stat-item"><i class="bi bi-chat-fill"></i> ${formatCount(
              stats.comments
            )}</span>
            <span class="result-stat-item"><i class="bi bi-share-fill"></i> ${formatCount(
              stats.shares
            )}</span>
          </div>
        </div>
      </div>
    </div>
  `;
 }

  // Build header card for Audio: title on top, avatar + nickname/username + post count below
  function buildAudioHeader(data) {
    const audioData = data.audio || {};
    const avatarUrl = proxiedImageUrl(data.author.avatar, data.author.nickname);
    const postCount = audioData.post_count;
    const postCountText =
      postCount === null || postCount === undefined
        ? "Jumlah postingan tidak tersedia"
        : `${formatCount(postCount)} postingan menggunakan audio ini`;

    // Ekstrak hashtag dan render title untuk audio juga
    const hashtags = extractHashtags(data.title);
    const titleHtml = renderTitleWithToggle(
      data.title || audioData.title,
      hashtags
    );

    resultHeaderSlot.innerHTML = `
    <div class="card card-custom result-header-card audio-header p-3 p-md-4 mb-4 border-0 shadow-lg">
      <div class="result-badge-wrapper">
        ${typeBadgeMarkup(data)}
      </div>
      <div class="result-title-row">
        <div class="result-post-title">${titleHtml}</div>
      </div>
      <div class="result-author-row">
        <img src="${avatarUrl}" alt="Avatar" class="result-avatar" onerror="this.onerror=null;this.src='${placeholderSrc(
      data.author.nickname
    )}';">
        <div class="result-author-text">
          <h6 class="result-nickname">${
            data.author.nickname || "TikTok User"
          }</h6>
          <span class="result-username">@${
            data.author.username || "tiktok"
          }</span>
          <span class="result-post-count">${postCountText}</span>
        </div>
      </div>
    </div>
  `;
  }

  // Render Result Function
  function renderTikTokResult(data) {
    // Clear previous views
    resultHeaderSlot.innerHTML = "";
    mediaViewSlot.innerHTML = "";
    activeSlideIndex = 0;

    if (data.type === "video") {
      buildVideoSlidesHeader(data);
      renderVideoView(data);
    } else if (data.type === "audio") {
      buildAudioHeader(data);
      renderAudioView(data);
    } else if (data.type === "slides") {
      buildVideoSlidesHeader(data);
      renderSlidesView(data);
    }

    resultContainer.classList.remove("d-none");
    resultContainer.scrollIntoView({ behavior: "smooth", block: "start" });

    // Attach download spinners to all media download links
    attachDownloadSpinnerListeners();
  }

  // Helper to attach loading spinners to download links
  function attachDownloadSpinnerListeners() {
    const downloadBtns = document.querySelectorAll(".js-download-btn");
    downloadBtns.forEach((btn) => {
      btn.addEventListener("click", function (e) {
        if (this.classList.contains("disabled") || this.disabled) return;

        const originalContent = this.innerHTML;
        this.classList.add("disabled");
        this.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Mengunduh...`;

        setTimeout(() => {
          this.classList.remove("disabled");
          this.innerHTML = originalContent;
        }, 3500);
      });
    });
  }

  // 1. Render Video View
  function renderVideoView(data) {
    const videoData = data.video || {};
    const audioData = data.audio || {};
    const cleanTitle = (data.title || "tiktok_video")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .substring(0, 30);

    const videoHtml = `
      <div class="card card-custom p-3 p-md-4 border-0 mb-4 shadow-lg">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-download text-primary-accent fs-5"></i>
          <h6 class="fw-bold text-white mb-0">Opsi Download Video</h6>
        </div>

        <div class="d-flex flex-column gap-3">
          ${
            videoData.no_watermark
              ? `
            <a href="/api/proxy-download?url=${encodeURIComponent(
              videoData.no_watermark
            )}&filename=${encodeURIComponent(cleanTitle)}&ext=mp4" 
               class="btn btn-primary-accent btn-lg py-3 fw-bold rounded-3 shadow-primary d-flex align-items-center justify-content-center gap-2 js-download-btn">
              <i class="bi bi-download fs-5"></i> Download Video (Tanpa Watermark)
            </a>
          `
              : ""
          }

          ${
            videoData.hd && videoData.hd !== videoData.no_watermark
              ? `
            <a href="/api/proxy-download?url=${encodeURIComponent(
              videoData.hd
            )}&filename=${encodeURIComponent(cleanTitle + "_HD")}&ext=mp4" 
               class="btn btn-dark-subtle border border-secondary text-light py-2.5 fw-semibold rounded-3 d-flex align-items-center justify-content-center gap-2 js-download-btn">
              <i class="bi bi-hd fs-5"></i> Download Video HD
            </a>
          `
              : ""
          }

          ${
            audioData.url
              ? `
            <a href="/api/proxy-download?url=${encodeURIComponent(
              audioData.url
            )}&filename=${encodeURIComponent(cleanTitle + "_audio")}&ext=mp3" 
               class="btn btn-outline-secondary text-light border-secondary py-2.5 fw-semibold rounded-3 d-flex align-items-center justify-content-center gap-2 js-download-btn">
              <i class="bi bi-music-note-beamed text-primary-accent fs-5"></i> Download Audio MP3
            </a>
          `
              : ""
          }
        </div>
      </div>
    `;

    mediaViewSlot.innerHTML = videoHtml;
  }

  // 2. Render Audio View
  function renderAudioView(data) {
    const audioData = data.audio || {};
    const cleanTitle = (audioData.title || data.title || "tiktok_audio")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .substring(0, 30);

    const audioHtml = `
      <div class="card card-custom p-3 p-md-4 border-0 mb-4 shadow-lg text-center">
        <div class="py-4">
          <div class="bg-primary-subtle text-primary border border-primary-subtle rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
            <i class="bi bi-disc fs-1"></i>
          </div>

          ${
            audioData.url
              ? `
            <div class="mb-4 max-w-600 mx-auto">
              <audio controls class="w-100 rounded-3">
                <source src="${audioData.url}" type="audio/mpeg">
              </audio>
            </div>
            
            <a href="/api/proxy-download?url=${encodeURIComponent(
              audioData.url
            )}&filename=${encodeURIComponent(cleanTitle)}&ext=mp3" 
               class="btn btn-primary-accent btn-lg py-3 px-4 fw-bold rounded-3 shadow-primary d-inline-flex align-items-center gap-2 js-download-btn">
              <i class="bi bi-download fs-5"></i> Download Audio MP3
            </a>
          `
              : '<p class="text-danger">Audio tidak tersedia.</p>'
          }
        </div>
      </div>
    `;

    mediaViewSlot.innerHTML = audioHtml;
  }

  // 3. Render Photo Slides View
  function renderSlidesView(data) {
    const slides = data.slides || [];
    const audioData = data.audio || {};
    const cleanTitle = (data.title || "tiktok_slides")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .substring(0, 30);

    let slidesHtml = `
      <!-- Main Slide Carousel Preview Card -->
      <div class="card card-custom p-3 p-md-4 border-0 mb-4 shadow-lg">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h6 class="fw-bold text-white mb-0"><i class="bi bi-images text-primary-accent me-1"></i> Preview Slide Foto</h6>
          <span class="slide-counter-badge" id="slideBadgeCounter">1 / ${
            slides.length
          }</span>
        </div>

        <div class="slides-carousel-container mb-3">
          <div class="slide-main-viewport">
            <button class="carousel-nav-btn prev-btn" id="btnPrevSlide"><i class="bi bi-chevron-left fs-5"></i></button>
            <img id="mainSlideImg" src="${
              slides[0]
            }" class="slide-main-img" alt="Slide 1">
            <button class="carousel-nav-btn next-btn" id="btnNextSlide"><i class="bi bi-chevron-right fs-5"></i></button>
          </div>
          
          <!-- Thumbnail Track -->
          <div class="thumbnail-track" id="thumbTrack">
            ${slides
              .map(
                (imgUrl, idx) => `
              <div class="thumb-item ${
                idx === 0 ? "active" : ""
              }" data-idx="${idx}">
                <img src="${imgUrl}" alt="Thumb ${idx + 1}">
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Checkbox Selection Controls Header -->
        <div class="p-3 bg-dark-subtle rounded-3 border border-secondary-subtle d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div class="form-check mb-0">
            <input class="form-check-input bg-dark border-secondary" type="checkbox" id="selectAllSlides" checked>
            <label class="form-check-label fw-bold text-white fs-7" for="selectAllSlides">
              Pilih Semua Foto (<span id="selectedCountText">${
                slides.length
              }</span>/${slides.length})
            </label>
          </div>

          <button id="btnDownloadZip" class="btn btn-primary-accent btn-sm py-2 px-3 fw-bold rounded-3 d-flex align-items-center gap-1">
            <i class="bi bi-download"></i> <span class="d-none d-sm-inline">Download Selected Images</span><span class="d-inline d-sm-none">Download Selected</span> (<span id="btnZipCount">${
              slides.length
            }</span>)
          </button>
        </div>

        <!-- Grid of Photo Cards -->
        <div class="row g-2 g-md-3 mb-4" id="photoGrid">
          ${slides
            .map(
              (imgUrl, idx) => `
            <div class="col-6 col-sm-4 col-md-3">
              <div class="photo-card selected" id="photoCard_${idx}">
                <input type="checkbox" class="card-checkbox slide-checkbox" data-idx="${idx}" data-url="${imgUrl}" checked>
                <div class="img-container" onclick="openImageModal('${imgUrl}')" style="cursor: pointer;">
                  <img src="${imgUrl}" alt="Slide ${idx + 1}">
                </div>
                <div class="p-2 text-center bg-card-grey border-top border-secondary-subtle">
                  <a href="/api/proxy-download?url=${encodeURIComponent(
                    imgUrl
                  )}&filename=${encodeURIComponent(
                cleanTitle + "_slide_" + (idx + 1)
              )}&ext=jpg" 
                     class="btn btn-dark-subtle text-light border border-secondary btn-sm w-100 fw-medium fs-7 py-1 js-download-btn">
                    <i class="bi bi-download"></i> Unduh
                  </a>
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <!-- Convert Slides to Video MP4 Box (Hidden if only 1 slide selected) -->
        <div id="convertVideoCard" class="p-3 p-md-4 rounded-3 border border-primary-subtle bg-dark-subtle mb-3">
          <div class="d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-camera-reel-fill text-primary-accent fs-4"></i>
            <div>
              <h6 class="fw-bold text-white mb-0">Konversi Slide Foto Menjadi Video MP4</h6>
              <small class="text-secondary">Ubah slide foto terpilih menjadi video MP4 dengan musik dan transisi.</small>
            </div>
          </div>

          <div class="row g-2 mb-3">
            <div class="col-12 col-md-6">
              <label class="form-label text-secondary fs-7 mb-1">Efek Transisi:</label>
              <select id="selectTransition" class="form-select bg-card-grey text-white border-secondary fs-7">
                <option value="slide_left" selected>Slide Left (Geser Kiri)</option>
                <option value="slide_right">Slide Right (Geser Kanan)</option>
                <option value="fade">Fade / Crossfade</option>
              </select>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label text-secondary fs-7 mb-1">Durasi Per Slide:</label>
              <select id="selectDuration" class="form-select bg-card-grey text-white border-secondary fs-7">
                <option value="1.5">1.5 Detik</option>
                <option value="2.0">2.0 Detik</option>
                <option value="2.5" selected>2.5 Detik (Default)</option>
                <option value="3.0">3.0 Detik</option>
                <option value="4.0">4.0 Detik</option>
              </select>
            </div>
          </div>

          <button id="btnConvertToVideo" class="btn btn-primary-accent w-100 py-3 fw-bold rounded-3 shadow-primary d-flex align-items-center justify-content-center gap-2">
            <span id="convertBtnText"><i class="bi bi-file-earmark-play-fill"></i> Download Sebagai Video MP4</span>
            <span id="convertBtnSpinner" class="spinner-border spinner-border-sm d-none" role="status"></span>
          </button>
        </div>

        <!-- Download Audio Option below slides -->
        ${
          audioData.url
            ? `
          <div class="mt-2 text-center">
            <a href="/api/proxy-download?url=${encodeURIComponent(
              audioData.url
            )}&filename=${encodeURIComponent(cleanTitle + "_audio")}&ext=mp3" 
               class="btn btn-outline-secondary text-light border-secondary w-100 py-2.5 fw-semibold rounded-3 d-inline-flex align-items-center justify-content-center gap-2 js-download-btn">
              <i class="bi bi-music-note-beamed text-primary-accent"></i> Download Audio / Musik Backsound (MP3)
            </a>
          </div>
        `
            : ""
        }

      </div>
    `;

    mediaViewSlot.innerHTML = slidesHtml;

    // Attach Slide Interactivity
    setupSlidesInteractivity(slides, audioData, cleanTitle);
  }

  // Interactivity for Slides
  function setupSlidesInteractivity(slides, audioData, cleanTitle) {
    const mainSlideImg = document.getElementById("mainSlideImg");
    const slideBadgeCounter = document.getElementById("slideBadgeCounter");
    const btnPrevSlide = document.getElementById("btnPrevSlide");
    const btnNextSlide = document.getElementById("btnNextSlide");
    const thumbTrack = document.getElementById("thumbTrack");
    const selectAllSlides = document.getElementById("selectAllSlides");
    const selectedCountText = document.getElementById("selectedCountText");
    const btnZipCount = document.getElementById("btnZipCount");
    const btnDownloadZip = document.getElementById("btnDownloadZip");
    const btnConvertToVideo = document.getElementById("btnConvertToVideo");
    const selectTransition = document.getElementById("selectTransition");
    const selectDuration = document.getElementById("selectDuration");
    const convertVideoCard = document.getElementById("convertVideoCard");

    function updateMainSlide(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;

      activeSlideIndex = index;
      mainSlideImg.style.opacity = "0.3";
      setTimeout(() => {
        mainSlideImg.src = slides[activeSlideIndex];
        mainSlideImg.style.opacity = "1";
      }, 150);

      slideBadgeCounter.textContent = `${activeSlideIndex + 1} / ${
        slides.length
      }`;

      // Update thumbnail active
      const thumbs = thumbTrack.querySelectorAll(".thumb-item");
      thumbs.forEach((t, idx) => {
        if (idx === activeSlideIndex) {
          t.classList.add("active");
          t.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        } else {
          t.classList.remove("active");
        }
      });
    }

    btnPrevSlide.addEventListener("click", () =>
      updateMainSlide(activeSlideIndex - 1)
    );
    btnNextSlide.addEventListener("click", () =>
      updateMainSlide(activeSlideIndex + 1)
    );

    thumbTrack.addEventListener("click", (e) => {
      const thumb = e.target.closest(".thumb-item");
      if (thumb) {
        const idx = parseInt(thumb.getAttribute("data-idx"));
        updateMainSlide(idx);
      }
    });

    // Checkboxes Handling
    const checkboxes = document.querySelectorAll(".slide-checkbox");

    function updateSelectionStats() {
      const checkedBoxes = document.querySelectorAll(".slide-checkbox:checked");
      const count = checkedBoxes.length;

      selectedCountText.textContent = count;
      btnZipCount.textContent = count;

      // Hide MP4 conversion card if only 1 or 0 slides selected
      if (count <= 1) {
        if (convertVideoCard) convertVideoCard.classList.add("d-none");
      } else {
        if (convertVideoCard) convertVideoCard.classList.remove("d-none");
      }

      if (count === slides.length) {
        selectAllSlides.checked = true;
        selectAllSlides.indeterminate = false;
      } else if (count === 0) {
        selectAllSlides.checked = false;
        selectAllSlides.indeterminate = false;
      } else {
        selectAllSlides.checked = false;
        selectAllSlides.indeterminate = true;
      }

      checkboxes.forEach((cb) => {
        const idx = cb.getAttribute("data-idx");
        const card = document.getElementById(`photoCard_${idx}`);
        if (cb.checked) {
          card.classList.add("selected");
        } else {
          card.classList.remove("selected");
        }
      });
    }

    // Call updateSelectionStats once initially
    updateSelectionStats();

    selectAllSlides.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      checkboxes.forEach((cb) => {
        cb.checked = isChecked;
      });
      updateSelectionStats();
    });

    checkboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        updateSelectionStats();
      });
    });

    // Download Selected Images (Individual file by file download)
    btnDownloadZip.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".slide-checkbox:checked");
      if (checkedBoxes.length === 0) {
        showToast("Pilih minimal 1 foto slide untuk didownload.", "error");
        return;
      }

      const selectedItems = Array.from(checkedBoxes).map((cb) => ({
        idx: cb.getAttribute("data-idx"),
        url: cb.getAttribute("data-url"),
      }));

      btnDownloadZip.disabled = true;

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        btnDownloadZip.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Mengunduh (${
          i + 1
        }/${selectedItems.length})...`;

        const downloadUrl = `/api/proxy-download?url=${encodeURIComponent(
          item.url
        )}&filename=${encodeURIComponent(
          cleanTitle + "_slide_" + (parseInt(item.idx) + 1)
        )}&ext=jpg`;

        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${cleanTitle}_slide_${parseInt(item.idx) + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (i < selectedItems.length - 1) {
          await new Promise((res) => setTimeout(res, 350));
        }
      }

      showToast("Semua foto terpilih berhasil diunduh!", "success");
      btnDownloadZip.disabled = false;
      btnDownloadZip.innerHTML = `<i class="bi bi-download"></i> Download Selected Images (<span id="btnZipCount">${selectedItems.length}</span> Foto)`;
    });

    // Convert Slides to Video MP4
    btnConvertToVideo.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".slide-checkbox:checked");
      if (checkedBoxes.length < 2) {
        showToast(
          "Konversi ke Video MP4 membutuhkan minimal 2 foto slide.",
          "error"
        );
        return;
      }

      const selectedUrls = Array.from(checkedBoxes).map((cb) =>
        cb.getAttribute("data-url")
      );
      const transition = selectTransition.value;
      const duration = parseFloat(selectDuration.value);

      const convertBtnText = document.getElementById("convertBtnText");
      const convertBtnSpinner = document.getElementById("convertBtnSpinner");

      btnConvertToVideo.disabled = true;
      convertBtnSpinner.classList.remove("d-none");
      convertBtnText.textContent = " Memproses & Mengonversi Video MP4...";

      showToast(
        "Proses konversi slide ke video sedang berjalan, mohon tunggu beberapa detik...",
        "info",
        6000
      );

      try {
        const resp = await fetch("/api/convert-slides-to-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: selectedUrls,
            audio_url: audioData.url || "",
            duration_per_slide: duration,
            transition: transition,
          }),
        });

        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          throw new Error(
            errJson.message || "Gagal mengonversi slide ke video."
          );
        }

        const blob = await resp.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `tiktok_slideshow_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        showToast(
          "Video MP4 hasil konversi slide berhasil didownload!",
          "success"
        );
      } catch (err) {
        console.error(err);
        showToast(
          err.message || "Gagal mengonversi slide foto ke video MP4.",
          "error"
        );
      } finally {
        btnConvertToVideo.disabled = false;
        convertBtnSpinner.classList.add("d-none");
        convertBtnText.innerHTML =
          '<i class="bi bi-file-earmark-play-fill"></i> Download Sebagai Video MP4';
      }
    });
  }

  // Fungsi untuk ekstrak hashtag dari judul
  function extractHashtags(text) {
    if (!text) return [];
    const hashtags = text.match(
      /#[\w\u0590-\u05fe\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF]+/g
    );
    return hashtags ? hashtags.map((t) => t.trim()) : [];
  }

  // Fungsi untuk menghitung jumlah kata
  function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  // Fungsi untuk render judul dengan toggle (hanya jika > 10 kata)
  function renderTitleWithToggle(title, hashtags) {
    const hasHashtags = hashtags && hashtags.length > 0;

    // Pisahkan judul dan hashtag
    let cleanTitle = title || "Tanpa Judul";
    let extractedHashtags = [];

    if (hasHashtags) {
      // Hapus hashtag dari judul untuk ditampilkan terpisah
      extractedHashtags = hashtags;
      hashtags.forEach((tag) => {
        cleanTitle = cleanTitle.replace(tag, "");
      });
      cleanTitle = cleanTitle.trim();
    }

    const wordCount = countWords(cleanTitle);
    const needsToggle = wordCount > 10;

    let html = `
    <div class="expandable-text">
      <div class="text-content ${
        needsToggle ? "" : "expanded"
      }" id="titleContent">
        ${cleanTitle || "Tanpa Judul"}
        ${
          extractedHashtags.length > 0
            ? `
          <div class="hashtag-list">
            ${extractedHashtags
              .map((tag) => `<span class="hashtag-item">${tag}</span>`)
              .join("")}
          </div>
        `
            : ""
        }
      </div>
      ${
        needsToggle
          ? `
        <button class="toggle-btn" id="toggleTitleBtn" onclick="toggleTitleExpand()">
          <i class="bi bi-chevron-down"></i> Tampilkan Selengkapnya
        </button>
      `
          : ""
      }
    </div>
  `;

    return html;
  }

  // Fungsi toggle untuk judul
  window.toggleTitleExpand = function () {
    const content = document.getElementById("titleContent");
    const btn = document.getElementById("toggleTitleBtn");
    if (content) {
      content.classList.toggle("expanded");
      if (content.classList.contains("expanded")) {
        btn.innerHTML = '<i class="bi bi-chevron-up"></i> Sembunyikan';
      } else {
        btn.innerHTML =
          '<i class="bi bi-chevron-down"></i> Tampilkan Selengkapnya';
      }
    }
  };

  // Image Modal Preview Global Function
  window.openImageModal = function (imgUrl) {
    const modalPreviewImg = document.getElementById("modalPreviewImg");
    if (modalPreviewImg) {
      modalPreviewImg.src = imgUrl;
      const modal = new bootstrap.Modal(
        document.getElementById("imagePreviewModal")
      );
      modal.show();
    }
  };
});
