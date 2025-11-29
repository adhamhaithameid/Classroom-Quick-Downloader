var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const DOWNLOAD_ICON_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`;
  const SUCCESS_ICON_SVG_RAW = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="160" height="160" fill="url(#pattern0_1_2484)"/>
<defs>
<pattern id="pattern0_1_2484" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_1_2484" transform="scale(0.00625)"/>
</pattern>
<image id="image0_1_2484" width="160" height="160" preserveAspectRatio="none" xlink:href="data:image/png;base64,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"/>
</defs>
</svg>`;
  const ERROR_ICON_SVG_RAW = `<svg fill="none" height="160" viewBox="0 0 160 160" width="160" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <pattern id="a" height="1" patternContentUnits="objectBoundingBox" width="1">
    <image height="160" preserveAspectRatio="none" transform="scale(.00625)" width="160" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAM9UlEQVR4Ae3dS4/b1hUH8DNAooXbjWUggFcBsklWQWbVIkBiLQIj48kgCJBvUffh1gujXdQpxuO+P0K76Bco8i26SGp30XebAEVrJ3Ycv8b2zDi+xZ/DP03RQ5GU7iXPkc4AxB1RFHnvOT9eXlISJZLwb39j45tfvffehTCZPJdwM77qBBFAzpA75DDB6tOvMpw+/cpXGxtXH585Ew7efvty+i36FmJGADlD7pBD5DLmupOvaw/4Njc/Onj11XBw8mR4/MYb4WBz81LyDfsGokQAucpydvJkQA6RS+Q0yspTrwQVPQC+9fWwPxqFfZGwf+JEOJhMHGHq4EdYP/AhV8hZlrvRKCCXyKl6hGV8B8QHgCLhYDx2hBGApFwF8SFXGT7mzgLCWfjYGEeYks9i667DV+ROM8I2+IqGeE+4mJQEr27CV+ROI0Li2y+P+fKumxV/pnSECRjNt0ri268cdp/JGXOKoZWWMWEZ395oFPZEWk9osJ+YzIcm1qvK+LrkDrkeHOEi+IrGOsJYljqvh/j2xuPWnUaRN3Q0QyKMgo+9pSPsjGfRFyyMj7kbAmFUfGyII1zUVOvXR8PH3PWJMAm+vCE+JmxtaO4FiQ+xnjqcEtO8ZR8Iq/gezVvZmtdl6/OecG5cTS8kPoz5kuQuJULg28dbMevr4dFolDUAjUgxIUD7k0nY8/eOm0y1fh6xzGKa40uRt2yduBKCy3Ex37brE18RGEfYGlfTgsT3KDU+dkgxEQ6Cjw1xhE22Gp/vHR9zFwMh8eGCY+rDbtHzsQF56YfjRmO1CxAfx3x1MU42Px8TznU4Jr4+xnyNAfCesBZZ3RPE19tht9JxFDmdpycEvr38hOPhaBQeigw+IZB7fmJS521qPvAhVoiZhtzBEDqyzFTTh1qJ79H6etCCj0F0hFPOjnygDh87L1w5aUKoGZ8jPNLb1Ey1+Nog3Nvayg67Gns+4mPpPeGUu+yBenxHIdzaOvyOSXjzzdfDmTNXnrz2mrrDLtFVS0f4FKEZfCWEsAZzsCcfHj/+ww9PnAifPP98CPlCD7iw5hIXVlf8xAT4EIOHWk44ZnihKRiDNZiDPbko8vXvilz+tUj4VGQKIV6keULgswSs4Nt2D0v4NOeIdcNRDPhgDNZgDvbYl6+dF9lxhAyH7tI6PlgTkbVqlB1hNSIKHy8rPoa6QPiJH44ZEzWlVXywhKNrXc9XDfAUwif5OHBX+XgwG2tgMI5B+RKOCdEmtO3BeKx6XI480ArsdMVHjBnCX4mEf4uEMkKsXPOEBC0bwjI+zbFn3YAQZmAHhtr2fMTH0hEyEgOWq4qPITeN0PolGuBDG9Crs3fRXMbq+YiPZe2YUHMwsroZPhyz59s1hm/eMR+x1ZVTPeFX+TjwvkjQPiGB1saEZXza44v6YWeHiUXHfHX4OH/t+yI7PDGxhvCBkbNj4ENdseNYxAcjR11kJqJFS0e4aARnvN7xzQhO6SnTCLUejq0fdlP3fCV/2b8Fwn/lx3+MAywcMu7jQq6ywzF7PtTNQgw55kPuMSTrGx8xTiF8nAO8JxK0T0S4q+AdE9QBOwTqpD1uqB92EOR6aHxTCH8pEv6ZVwwVNBFIXN7AYH9AhNg26mANH3KNnA/V8xEfy+ISDfYKaz3hUAit4mPPN+/ba0QTuzSNMLvs0WNPaP2wqw0fMWcILR6O7+UnJn0cjokP2zQxVMmPajzsasVXIMS4gAgP8vHgXZGgfeoDYRmf9nigfthBkEPi0zLmI7a6Mjs7/oVI+EfeADTERMAT9oRW8SGHyKUVfESZIfSe8DAcVvFZ6/mIj6UjFJHdzc1tnOTgEG/iKGD0sEt01dI0wkUv0QAf1mENHw67mq7zVVF1fVwgRMPwCzzoCe4YmO4ucLGa+LAOE23Nc2N1zNeEMkPIE5NlR2gV39+NnnA04ePzK4HQ8THdOsulRmgV37Iedut2AdMI79d8gAH48JyP+erSrmt+gRDjDvxqDwbqtw1Md/CZPZzZlt47vrexkeHDcybakMd82cd8TeQzhD8XCRYR3jt1Kuy+//6PMeF/i/gQe2vvcDSh6vq8aYS777wTMDm+rmnXtbxdhMeOhTvHjpk77HrP9+wOUCD8m7ExoaUxH2Lr+J7FxzlTCPFjJ0julz4tFAPEELF0fGQ2u3SEEXc4xzcbW92zjjACQsdXx6vdfEe4AELH1w5Z01IFwr/m4xgE1seEs2NAfIiZn3A0EWt+fu17Ijs/EwkIKG71D4C3fDoyBogNYoRYIWaIXcobBTWnbzmWcIQtdjjHlxa7I5yB0PGlxce1O8IjEDo+8uindIQlhI6vH3TVrRQI/5L/dglOSr5YsQltxk3BEQM/4agSSf94pRE6vvTA2mxhJRE6vjY0+ltmpRA6vv5gddnSSiB0fF1I9L9sgfDP+e9W4KTk5hKcmLANuC8z2vZTf4ejf10tt5ghRIKqCJFEqxN2JMfXUoCCxZYKoeNTIGqOKkwhxE3TeTi21Auizqi7H3bnEKDgJWvfEtn5QCT8Mf/OsSV8qCu+J426ow1oi3+qRYGqrlW4OBr95PciT5BQS70g64q6ow1d2+3LK4nAtVOnPrj+4otPPhcJN4xNqDPqjjYoCadXo0sEdre2tnffeivcfuEFc/i4s6DuaMPuu+9e6tJ2X3bgCNze3Nz+cjIJN8djs/iIEG1AW26X7kUzcHh987MisEz4HOGsTCt8DvhuL0nPR3ws0ROibd4TKoSHKpV7PosnHYRWV6JNfjhWju/GeByQqGWe0EYfEyqCyJ5vFfBxx3KESgCuIj5HqAgfBuWr1PMRH0u03U9MBgDJng+DciZjVUs/MekZIPDdmkzC5+Nx+EzEJ5x0jccBMfFLNIkxOr76Hc4ROr7Be2NHmAih93z1PV91GOIIIyN0fO3xEaMjjITQ8XXH5wgj4bu1ubn9RX62ex0fzvSpcwzQEyKGt/yjXN1UEt9n43HnoDvU6Z0VMXSEHfw5vmlAMXYoR9gSoOOLj4+AHWEDQov4+FVPJll76QhrEFrDhzNNfHXy03zC/5inHSDq5wgrCC3iw29xXM3vTIq7k+J/zHOEleRqf1jGd00kaJ/QgwDan0TCjkg4K3IRE/7HPDyHZbS3A/Vb+Z7QKj70dpdEwncOb5eR7eP4H/PYExpEuK29s4paP8v40Nvl+NZKQVnDPDznCEtR0fjvEuJjmB0hI6G1XGJ8DLkjZCS0lSuAjyF3hIyElnKF8DHkjpCRGLq0iA8/gVU52y2fcLQNaYaQZ8dYp58dtw1dpOWI79p4HP4non7C9THi2z68zrfonUnXzorsYF0AjXVjGyZi8fRTNDYv0QDfzckkXDeG74pIiISPu3GBEOu2hBC5Qw6RSzbGRGkZHw6Z6LUi35M5Q4h1O8LEhB1fbYAdYW1oIj3h+BoD6QgbQzTnAo6vdeAcYetQtVzQ8bUM1NPFHOHTWCz2n+ObO36OcO7Q5S+0iA8/e4oz0URnu11DOoUQdbNynXDwSzQ38+t8uMj8XxH1Ey7+KsNHrM8gRF0txBS5x3VCWGBjeimxwRuTSbCED9/bwG+vRb7IHCveGULUDXVEXS0hhIXeEFrEx55PKT4iLhBiiIA6O0KGJi8dXyUg8R86wrqYOr66yESf7wirIXV81Ygkf+wIGWLHx0j0XjpCx9c7uuoGVxeh46taGOzx6iF0fINhq9vw6iB0fHUGBp+//Agd3+DImiqwvAgdX1Pu1Ty/XAjD6dNf293auoSferL03q6Rt9dSqTWNENZgDvbk45deuvDxyy+H/xw/nt3fTvunMMqfalH+3m4qfFyvSYS4hyKswRzsyY9EXj8ncuW3eEIk4CfjtSJ0fLRXlKYQwhaMwRrMwV7WkrMir3xb5KPfKEbo+Ap01X9MICQ+GIM1mJtqyA8UI3R8U6k66oFqhFV8sHZUI0QjQsd3ZKqOmqkSYWt8bJEmhI6PWWldqkLYGR+bqQGh42M2OpcqEM6Nj80dEqHjYxbmLgdFuDA+NnsIhI6P0V+4HARhNHxsfp8IHR+jHq3sFWF0fAxDHwgdH6MdvewFYTJ8DEdKhI6PUU5WJkWYHB/DkgKh42N0k5dJEPaGj+GJidDxMaq9lVER9o6PYYqB0PExmr2XURAOho/hWgSh42MUBysXQjg4PoZtHoSOj9EbvJwLoRp8DF8XhI6PUVNTdkKoDh/D2Aah42O01JWtEKrFx3DOQuj4GCW15UyE6vExrHUIV/wLRAyP9nIKIW6Sia9mmMHH6FYR3tV9Z1JW28vDCBQIcadW5A7f4eDH6JFbE4Eiwt+JhD+IhMtpfv7KRCwMVjJDiJwhd8ghvsNhBh8DjgqfF7l64fAbUJcj//YaN+NlmgisnRO5jNwhh+bwMSbnRb5xTuTCRZHnOM9LGxFAzpA75DBljf8PNhWQD8NxltgAAAAASUVORK5CYII="/>
  </pattern>
  <path d="m0 0h160v160h-160z" fill="url(#a)"/>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const SUCCESS_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    SUCCESS_ICON_SVG_RAW
  )}`;
  const ERROR_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    ERROR_ICON_SVG_RAW
  )}`;
  const STYLE_ID = "cqd-style";
  const SPINNER_SIZE_PX = 16;
  const TRANSITION_MS = 150;
  const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};

      /* Spinner */
      --cqd-spinner-border: rgba(255, 255, 255, 0.22);
      --cqd-spinner-top: #ffffff;

      /* =================================================================
       * COLOR PALETTE (Light)
       * ================================================================= */
      --cqd-color-normal: #005DD7;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 93, 215, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 93, 215, 0.70);

      --cqd-color-success: #00A82D;
      --cqd-shadow-success: 0 12px 28px rgba(0, 168, 45, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(0, 168, 45, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #EC6300;
      --cqd-shadow-trying: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #007F8D;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
    }

    /* =================================================================
     * DARK MODE
     * ================================================================= */
    .cqd-theme-dark {
      --cqd-color-normal: #006EFF;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 110, 255, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 110, 255, 0.70);

      --cqd-color-success: #07DA3F;
      --cqd-shadow-success: 0 12px 28px rgba(7, 218, 63, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(7, 218, 63, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #FF9142;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #00D6EE;

      --cqd-spinner-border: rgba(15, 23, 42, 0.22);
      --cqd-spinner-top: #0f172a;
    }

    div[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      z-index: 1;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON (Single)
     * =============================== */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);
      padding: 0;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-base);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
      transform: scale(0.97);
    }

    .cqd-download-btn:active {
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-trying,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-normal);
      width: 150px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-trying {
      width: 110px;
      background-color: var(--cqd-color-trying);
      box-shadow: var(--cqd-shadow-trying);
    }

    .cqd-download-btn.cqd-loading:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-btn.cqd-trying:hover {
      box-shadow: var(--cqd-shadow-trying-strong);
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success:hover {
      box-shadow: var(--cqd-shadow-success-strong);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-error {
      width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
      height: 40px;
      max-width: 150px;
      max-height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      align-items: center;
      transition: all var(--cqd-transition);
    }

    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      margin: 0;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      white-space: normal;
      transform: translateY(4px);
      transition: all var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error:hover {
      width: 350px;
      max-width: 360px;
      height: 60px;
      max-height: 61px;
      padding: 8px;
      border-radius: 18px;
      align-items: center;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border: 3px solid var(--cqd-spinner-border);
      border-top-color: var(--cqd-spinner-top);
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ===============================
     * 2. COMMENTS & EDITED (Overlay)
     * =============================== */
    .cqd-overlay-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit;
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    .cqd-comment-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-comment);
      color: #ffffff;
      border-radius: 9999px;
      cursor: pointer;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
    }

    .cqd-comment-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      margin-top: 4px;
    }

    .cqd-badge-label {
      display: block;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      opacity: 0;
      transform: translateY(-5px);
      max-height: 0;
      margin-top: 2px;
      overflow: hidden;
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-overlay-container.cqd-edited {
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-edited),
        0 0 12px rgba(0, 214, 238, 0.3);
    }

    .cqd-edited-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-edited);
      color: #ffffff;
      border-radius: 9999px;
      cursor: default;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-edited-badge {
      right: 0;
      transform: translateX(50%);
    }

    body[data-cqd-dir="ltr"] .cqd-edited-badge {
      left: 0;
      transform: translateX(-50%);
    }

    .cqd-edited-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-edited-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .cqd-edited-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    .cqd-edited-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    .cqd-edited-badge:hover .cqd-edited-content {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-diff-val {
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    div[data-stream-item-id][data-cqd-processed][data-cqd-edited-processed] > .cqd-overlay-container {
      box-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    .cqd-both-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 70px;
      background-color: #FF4036;
      color: #ffffff;
      border-radius: 9999px;
      border: 1px solid rgba(255, 64, 54, 0.70);
      cursor: pointer;
      overflow: hidden;
      padding-top: 8px;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
    }

    body[data-cqd-dir="ltr"] .cqd-both-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-both-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-both-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .cqd-both-icon {
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    .cqd-both-icon-edited svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .cqd-both-plus {
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      margin: 5px;
    }

    .cqd-both-value,
    .cqd-both-divider {
      opacity: 0;
      max-height: 0;
      margin-top: 0;
      overflow: hidden;
      transition:
        opacity 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
    }

    .cqd-both-value {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }

    .cqd-both-badge:hover {
      height: 120px;
      border-radius: 20px;
    }

    .cqd-both-badge:hover .cqd-both-value {
      opacity: 1;
      max-height: 20px;
      margin-top: 2px;
    }

    .cqd-both-badge:hover .cqd-both-divider {
      opacity: 1;
      max-height: 4px;
      margin-top: 2px;
    }

    /* ===============================
     * 1b. DOWNLOAD ALL BUTTON (Header-aligned)
     * =============================== */

    .cqd-download-all-btn {
      /* Progress control (0% to 100%) */
      --cqd-progress: 0%;
      position: absolute;
      top: 12px;
      right: 48px;
      height: 40px;
      z-index: 6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-normal);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      transition:
        box-shadow 0.2s ease,
        transform 0.1s ease,
        background-color 0.3s ease;
      transform: translateZ(0);
    }

    /* When injected into the header flex structure */
    .cqd-download-all-btn.cqd-in-header {
      position: relative;
      top: auto;
      right: auto;
      left: auto;
      bottom: auto;
      transform: none;
      
      /* Important: Margin to separate from the "Three Dots" menu */
      margin-inline-end: 8px;
      
      /* Ensure it doesn't get crushed in flex rows */
      flex-shrink: 0;
      align-self: center;
    }

    /* RTL fallback only for non-header cases (absolute positioned at top corner) */
    body[data-cqd-dir="rtl"] .cqd-download-all-btn:not(.cqd-in-header) {
      right: auto;
      left: 48px;
    }

    .cqd-download-all-btn:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-all-btn:active {
      transform: scale(0.97);
    }

    /* Keep pointer cursor even while disabled */
    .cqd-download-all-btn[disabled] {
      cursor: pointer;
    }

    /* FULL SUCCESS STATE (Solid Green) */
    .cqd-download-all-btn.cqd-all-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-all-btn.cqd-all-error {
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
    }

    /* PROGRESS BAR OVERLAY (Fills up) */
    .cqd-download-all-btn::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 0;

      background-color: var(--cqd-color-success);

      /* Width controlled by JS */
      width: var(--cqd-progress);
      transition: width 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);

      opacity: 1;
    }

    .cqd-download-all-btn.cqd-all-success::after {
      opacity: 0;
    }

    /* Content layers */
    .cqd-download-all-btn .cqd-download-all-main,
    .cqd-download-all-btn .cqd-download-all-sub,
    .cqd-download-all-btn .cqd-download-all-icon-wrapper {
      position: relative;
      z-index: 2;
    }

    .cqd-download-all-btn .cqd-download-all-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-all-btn .cqd-download-all-icon {
      width: 18px;
      height: 18px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      flex-shrink: 0;
    }

    .cqd-download-all-btn .cqd-download-all-main {
      font-weight: 600;
    }

    .cqd-download-all-btn .cqd-download-all-sub {
      font-size: 11px;
      opacity: 0.9;
      margin-left: 4px;
    }

  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const TRANSLATIONS = {
    en: {
      download: "Download",
      downloading: "Downloading…",
      trying: "Trying…",
      downloaded: "Downloaded",
      error: "Error",
      failed: "Download failed.",
      ariaDownload: "Download",
      titleQuick: "Quick download",
      comments: "comments",
      edited: "Edited",
      downloadAll: "Download all"
    },
    ar: {
      download: "تنزيل",
      downloading: "جاري التنزيل…",
      trying: "محاولة…",
      downloaded: "تم التنزيل",
      error: "خطأ",
      failed: "فشل التنزيل.",
      ariaDownload: "تنزيل",
      titleQuick: "تنزيل سريع",
      comments: "تعليقات",
      edited: "تم التعديل",
      downloadAll: "تنزيل الكل"
    },
    ja: {
      download: "ダウンロード",
      downloading: "DL中…",
      trying: "試行中…",
      downloaded: "完了",
      error: "エラー",
      failed: "失敗しました。",
      ariaDownload: "ダウンロード",
      titleQuick: "クイックダウンロード",
      comments: "件のコメント",
      edited: "編集済み"
    },
    es: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Intentando…",
      downloaded: "Descargado",
      error: "Error",
      failed: "Falló la descarga.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    hi: {
      download: "डाउनलोड",
      downloading: "डाउनलोडिंग…",
      trying: "कोशिश जारी…",
      downloaded: "पूर्ण",
      error: "त्रुटि",
      failed: "विफल रहा",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पणियाँ",
      edited: "संपादित"
    },
    pt: {
      download: "Baixar",
      downloading: "Baixando…",
      trying: "Tentando…",
      downloaded: "Baixado",
      error: "Erro",
      failed: "Falha ao baixar.",
      ariaDownload: "Baixar",
      titleQuick: "Download rápido",
      comments: "comentários",
      edited: "Editado"
    },
    "pt-pt": {
      download: "Descarregar",
      downloading: "A descarregar…",
      trying: "A tentar…",
      downloaded: "Descarregado",
      error: "Erro",
      failed: "Falha ao descarregar.",
      ariaDownload: "Descarregar",
      titleQuick: "Descarga rápida",
      comments: "comentários",
      edited: "Editado"
    },
    "zh-cn": {
      download: "下载",
      downloading: "下载中…",
      trying: "尝试中…",
      downloaded: "已下载",
      error: "错误",
      failed: "下载失败",
      ariaDownload: "下载",
      titleQuick: "快速下载",
      comments: "条评论",
      edited: "已编辑"
    },
    "zh-tw": {
      download: "下載",
      downloading: "下載中…",
      trying: "嘗試中…",
      downloaded: "已下載",
      error: "錯誤",
      failed: "下載失敗",
      ariaDownload: "下載",
      titleQuick: "快速下載",
      comments: "則留言",
      edited: "已編輯"
    },
    fr: {
      download: "Télécharger",
      downloading: "Téléchargement…",
      trying: "Essai…",
      downloaded: "Téléchargé",
      error: "Erreur",
      failed: "Échec.",
      ariaDownload: "Télécharger",
      titleQuick: "Téléchargement rapide",
      comments: "commentaires",
      edited: "Modifié"
    },
    de: {
      download: "Herunterladen",
      downloading: "Laden…",
      trying: "Versuchen…",
      downloaded: "Fertig",
      error: "Fehler",
      failed: "Fehlgeschlagen.",
      ariaDownload: "Herunterladen",
      titleQuick: "Schneller Download",
      comments: "Kommentare",
      edited: "Bearbeitet"
    },
    it: {
      download: "Scarica",
      downloading: "Scaricamento…",
      trying: "Provando…",
      downloaded: "Scaricato",
      error: "Errore",
      failed: "Fallito.",
      ariaDownload: "Scarica",
      titleQuick: "Download rapido",
      comments: "commenti",
      edited: "Modificato"
    },
    ru: {
      download: "Скачать",
      downloading: "Скачивание…",
      trying: "Попытка…",
      downloaded: "Скачано",
      error: "Ошибка",
      failed: "Сбой.",
      ariaDownload: "Скачать",
      titleQuick: "Быстрое скачивание",
      comments: "комментариев",
      edited: "Изменено"
    },
    ko: {
      download: "다운로드",
      downloading: "다운로드 중…",
      trying: "시도 중…",
      downloaded: "완료",
      error: "오류",
      failed: "실패함",
      ariaDownload: "다운로드",
      titleQuick: "빠른 다운로드",
      comments: "개 댓글",
      edited: "수정됨"
    },
    tr: {
      download: "İndir",
      downloading: "İndiriliyor…",
      trying: "Deneniyor…",
      downloaded: "İndirildi",
      error: "Hata",
      failed: "Başarısız.",
      ariaDownload: "İndir",
      titleQuick: "Hızlı indir",
      comments: "yorum",
      edited: "Düzenlendi"
    },
    vi: {
      download: "Tải xuống",
      downloading: "Đang tải…",
      trying: "Đang thử…",
      downloaded: "Đã tải",
      error: "Lỗi",
      failed: "Thất bại.",
      ariaDownload: "Tải xuống",
      titleQuick: "Tải xuống nhanh",
      comments: "nhận xét",
      edited: "Đã chỉnh sửa"
    },
    id: {
      download: "Download",
      downloading: "Mengunduh…",
      trying: "Mencoba…",
      downloaded: "Selesai",
      error: "Kesalahan",
      failed: "Gagal.",
      ariaDownload: "Download",
      titleQuick: "Download cepat",
      comments: "komentar",
      edited: "Diedit"
    },
    th: {
      download: "ดาวน์โหลด",
      downloading: "กำลังโหลด…",
      trying: "พยายาม…",
      downloaded: "เสร็จสิ้น",
      error: "ข้อผิดพลาด",
      failed: "ล้มเหลว",
      ariaDownload: "ดาวน์โหลด",
      titleQuick: "ดาวน์โหลดด่วน",
      comments: "ความคิดเห็น",
      edited: "แก้ไขแล้ว"
    },
    pl: {
      download: "Pobierz",
      downloading: "Pobieranie…",
      trying: "Próba…",
      downloaded: "Pobrano",
      error: "Błąd",
      failed: "Nieudane.",
      ariaDownload: "Pobierz",
      titleQuick: "Szybkie pobieranie",
      comments: "komentarze",
      edited: "Edytowano"
    },
    nl: {
      download: "Downloaden",
      downloading: "Downloaden…",
      trying: "Proberen…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Mislukt.",
      ariaDownload: "Downloaden",
      titleQuick: "Snel downloaden",
      comments: "reacties",
      edited: "Bewerkt"
    },
    bn: {
      download: "ডাউনলোড",
      downloading: "ডাউনলোড হচ্ছে…",
      trying: "চেষ্টা করছে…",
      downloaded: "সম্পন্ন",
      error: "ত্রুটি",
      failed: "ব্যর্থ হয়েছে",
      ariaDownload: "ডাউনলোড",
      titleQuick: "দ্রুত ডাউনলোড",
      comments: "টি মন্তব্য",
      edited: "সম্পাদিত"
    },
    pa: {
      download: "ਡਾਉਨਲੋਡ",
      downloading: "ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…",
      trying: "ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…",
      downloaded: "ਮੁਕੰਮਲ",
      error: "ਗਲਤੀ",
      failed: "ਅਸਫਲ",
      ariaDownload: "ਡਾਉਨਲੋਡ",
      titleQuick: "ਤੇਜ਼ ਡਾਉਨਲੋਡ",
      comments: "ਟਿੱਪਣੀਆਂ",
      edited: "ਸੰਪਾਦਿਤ"
    },
    te: {
      download: "డౌన్‌లోడ్",
      downloading: "డౌన్‌లోడ్ అవుతోంది…",
      trying: "ప్రయత్నిస్తోంది…",
      downloaded: "పూర్తయింది",
      error: "లోపం",
      failed: "విఫలమైంది",
      ariaDownload: "డౌన్‌లోడ్",
      titleQuick: "త్వరిత డౌన్‌లోడ్",
      comments: "వ్యాఖ్యలు",
      edited: "సవరించబడింది"
    },
    mr: {
      download: "डाउनलोड",
      downloading: "डाउनलोड होत आहे…",
      trying: "प्रयत्न करत आहे…",
      downloaded: "पूर्ण",
      error: "त्रुटी",
      failed: "अयशस्वी",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पण्या",
      edited: "संपादित"
    },
    ta: {
      download: "பதிவிறக்கு",
      downloading: "பதிவிறக்கப்படுகிறது…",
      trying: "முயற்சிக்கிறது…",
      downloaded: "முடிந்தது",
      error: "பிழை",
      failed: "தோல்வி",
      ariaDownload: "பதிவிறக்கு",
      titleQuick: "விரைவு பதிவிறக்கம்",
      comments: "கருத்துகள்",
      edited: "திருத்தப்பட்டது"
    },
    ur: {
      download: "ڈاؤن لوڈ",
      downloading: "ڈاؤن لوڈ ہو رہا ہے…",
      trying: "کوشش جاری…",
      downloaded: "مکمل",
      error: "غلطی",
      failed: "ناکام",
      ariaDownload: "ڈاؤن لوڈ",
      titleQuick: "فوری ڈاؤن لوڈ",
      comments: "تبصرے",
      edited: "ترمیم شدہ"
    },
    gu: {
      download: "ડાઉનલોડ",
      downloading: "ડાઉનલોડ થઈ રહ્યું છે…",
      trying: "પ્રયાસ ચાલુ…",
      downloaded: "પૂર્ણ",
      error: "ભૂલ",
      failed: "નિષ્ફળ",
      ariaDownload: "ડાઉનલોડ",
      titleQuick: "ઝડપી ડાઉનલોડ",
      comments: "ટિપ્પણીઓ",
      edited: "સંપાદિત"
    },
    kn: {
      download: "ಡೌನ್‌ಲೋಡ್",
      downloading: "ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      trying: "ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…",
      downloaded: "ಪೂರ್ಣಗೊಂಡಿದೆ",
      error: "ದೋಷ",
      failed: "ವಿಫಲವಾಗಿದೆ",
      ariaDownload: "ಡೌನ್‌ಲೋಡ್",
      titleQuick: "ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್",
      comments: "ಕಾಮೆಂಟ್‌ಗಳು",
      edited: "ಸಂಪಾದಿಸಲಾಗಿದೆ"
    },
    ml: {
      download: "ഡൗൺലോഡ്",
      downloading: "ഡൗൺലോഡ് ചെയ്യുന്നു…",
      trying: "ശ്രമിക്കുന്നു…",
      downloaded: "പൂർത്തിയായി",
      error: "പിശക്",
      failed: "പരാജയപ്പെട്ടു",
      ariaDownload: "ഡൗൺലോഡ്",
      titleQuick: "വേഗത്തിൽ ഡൗൺലോഡ്",
      comments: "അഭിപ്രായങ്ങൾ",
      edited: "എഡിറ്റുചെയ്തു"
    },
    uk: {
      download: "Завантажити",
      downloading: "Завантаження…",
      trying: "Спроба…",
      downloaded: "Готово",
      error: "Помилка",
      failed: "Невдача.",
      ariaDownload: "Завантажити",
      titleQuick: "Швидке завантаження",
      comments: "коментарів",
      edited: "Змінено"
    },
    el: {
      download: "Λήψη",
      downloading: "Λήψη…",
      trying: "Προσπάθεια…",
      downloaded: "Ολοκληρώθηκε",
      error: "Σφάλμα",
      failed: "Απέτυχε.",
      ariaDownload: "Λήψη",
      titleQuick: "Γρήγορη λήψη",
      comments: "σχόλια",
      edited: "Επεξεργασμένο"
    },
    cs: {
      download: "Stáhnout",
      downloading: "Stahování…",
      trying: "Zkouším…",
      downloaded: "Staženo",
      error: "Chyba",
      failed: "Selhalo.",
      ariaDownload: "Stáhnout",
      titleQuick: "Rychlé stažení",
      comments: "komentářů",
      edited: "Upraveno"
    },
    ro: {
      download: "Descărcați",
      downloading: "Se descarcă…",
      trying: "Se încearcă…",
      downloaded: "Finalizat",
      error: "Eroare",
      failed: "Eșuat.",
      ariaDownload: "Descărcați",
      titleQuick: "Descărcare rapidă",
      comments: "comentarii",
      edited: "Modificat"
    },
    hu: {
      download: "Letöltés",
      downloading: "Letöltés…",
      trying: "Próbálkozás…",
      downloaded: "Kész",
      error: "Hiba",
      failed: "Sikertelen.",
      ariaDownload: "Letöltés",
      titleQuick: "Gyors letöltés",
      comments: "megjegyzés",
      edited: "Szerkesztve"
    },
    sv: {
      download: "Ladda ner",
      downloading: "Laddar ner…",
      trying: "Försöker…",
      downloaded: "Klart",
      error: "Fel",
      failed: "Misslyckades.",
      ariaDownload: "Ladda ner",
      titleQuick: "Snabb nedladdning",
      comments: "kommentarer",
      edited: "Redigerad"
    },
    da: {
      download: "Hent",
      downloading: "Henter…",
      trying: "Prøver…",
      downloaded: "Hentet",
      error: "Fejl",
      failed: "Mislykkedes.",
      ariaDownload: "Hent",
      titleQuick: "Hurtig download",
      comments: "kommentarer",
      edited: "Redigeret"
    },
    fi: {
      download: "Lataa",
      downloading: "Ladataan…",
      trying: "Yritetään…",
      downloaded: "Ladattu",
      error: "Virhe",
      failed: "Epäonnistui.",
      ariaDownload: "Lataa",
      titleQuick: "Pikalataus",
      comments: "kommenttia",
      edited: "Muokattu"
    },
    no: {
      download: "Last ned",
      downloading: "Laster ned…",
      trying: "Prøver…",
      downloaded: "Ferdig",
      error: "Feil",
      failed: "Mislyktes.",
      ariaDownload: "Last ned",
      titleQuick: "Rask nedlasting",
      comments: "kommentarer",
      edited: "Redigert"
    },
    he: {
      download: "הורדה",
      downloading: "מוריד…",
      trying: "מנסה…",
      downloaded: "הושלם",
      error: "שגיאה",
      failed: "נכשל",
      ariaDownload: "הורדה",
      titleQuick: "הורדה מהירה",
      comments: "תגובות",
      edited: "נערך"
    },
    fa: {
      download: "دانلود",
      downloading: "درحال دانلود…",
      trying: "تلاش مجدد…",
      downloaded: "انجام شد",
      error: "خطا",
      failed: "ناموفق",
      ariaDownload: "دانلود",
      titleQuick: "دانلود سریع",
      comments: "نظر",
      edited: "ویرایش شده"
    },
    fil: {
      download: "I-download",
      downloading: "Nagda-download…",
      trying: "Sinusubukan…",
      downloaded: "Tapos na",
      error: "Error",
      failed: "Nabigo.",
      ariaDownload: "I-download",
      titleQuick: "Mabilis na download",
      comments: "mga komento",
      edited: "Na-edit"
    },
    ms: {
      download: "Muat turun",
      downloading: "Memuat turun…",
      trying: "Mencuba…",
      downloaded: "Selesai",
      error: "Ralat",
      failed: "Gagal.",
      ariaDownload: "Muat turun",
      titleQuick: "Muat turun pantas",
      comments: "komen",
      edited: "Diedit"
    },
    sr: {
      download: "Преузми",
      downloading: "Преузимање…",
      trying: "Покушавам…",
      downloaded: "Завршено",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преузми",
      titleQuick: "Брзо преузимање",
      comments: "коментара",
      edited: "Измењено"
    },
    sk: {
      download: "Stiahnuť",
      downloading: "Sťahovanie…",
      trying: "Skúšam…",
      downloaded: "Hotovo",
      error: "Chyba",
      failed: "Zlyhalo.",
      ariaDownload: "Stiahnuť",
      titleQuick: "Rýchle stiahnutie",
      comments: "komentárov",
      edited: "Upravené"
    },
    bg: {
      download: "Изтегли",
      downloading: "Изтегляне…",
      trying: "Опит…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Изтегли",
      titleQuick: "Бързо изтегляне",
      comments: "коментара",
      edited: "Редактирано"
    },
    hr: {
      download: "Preuzmi",
      downloading: "Preuzimanje…",
      trying: "Pokušavam…",
      downloaded: "Gotovo",
      error: "Greška",
      failed: "Neuspjelo.",
      ariaDownload: "Preuzmi",
      titleQuick: "Brzo preuzimanje",
      comments: "komentara",
      edited: "Uređeno"
    },
    lt: {
      download: "Atsisiųsti",
      downloading: "Siunčiama…",
      trying: "Bandoma…",
      downloaded: "Baigta",
      error: "Klaida",
      failed: "Nepavyko.",
      ariaDownload: "Atsisiųsti",
      titleQuick: "Greitas atsisiuntimas",
      comments: "komentarai",
      edited: "Redaguota"
    },
    lv: {
      download: "Lejupielādēt",
      downloading: "Lejupielādē…",
      trying: "Mēģina…",
      downloaded: "Pabeigts",
      error: "Kļūda",
      failed: "Neizdevās.",
      ariaDownload: "Lejupielādēt",
      titleQuick: "Ātrā lejupielāde",
      comments: "komentāri",
      edited: "Rediģēts"
    },
    et: {
      download: "Laadi alla",
      downloading: "Laadimine…",
      trying: "Proovin…",
      downloaded: "Valmis",
      error: "Viga",
      failed: "Ebaõnnestus.",
      ariaDownload: "Laadi alla",
      titleQuick: "Kiire allalaadimine",
      comments: "kommentaari",
      edited: "Muudetud"
    },
    sl: {
      download: "Prenos",
      downloading: "Prenašanje…",
      trying: "Poskušam…",
      downloaded: "Končano",
      error: "Napaka",
      failed: "Ni uspelo.",
      ariaDownload: "Prenos",
      titleQuick: "Hiter prenos",
      comments: "komentarjev",
      edited: "Urejeno"
    },
    ca: {
      download: "Descarrega",
      downloading: "Descarregant…",
      trying: "Intentant…",
      downloaded: "Descarregat",
      error: "Error",
      failed: "Ha fallat.",
      ariaDownload: "Descarrega",
      titleQuick: "Descàrrega ràpida",
      comments: "comentaris",
      edited: "Editat"
    },
    af: {
      download: "Aflaai",
      downloading: "Laai af…",
      trying: "Probeer…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Misluk.",
      ariaDownload: "Aflaai",
      titleQuick: "Vinnige aflaai",
      comments: "kommentare",
      edited: "Geredigeer"
    },
    am: {
      download: "አውርድ",
      downloading: "በማውረድ ላይ…",
      trying: "በመሞከር ላይ…",
      downloaded: "ወርዷል",
      error: "ስህተት",
      failed: "አልተሳካም።",
      ariaDownload: "አውርድ",
      titleQuick: "ፈጣን ማውረድ",
      comments: "አስተያየቶች",
      edited: "ተስተካክሏል"
    },
    hy: {
      download: "Ներբեռնել",
      downloading: "Ներբեռնում…",
      trying: "Փորձում է…",
      downloaded: "Ավարտված",
      error: "Սխալ",
      failed: "Ձախողվեց:",
      ariaDownload: "Ներբեռնել",
      titleQuick: "Արագ ներբեռնում",
      comments: "մեկնաբանություն",
      edited: "Խմբագրվել է"
    },
    as: {
      download: "ডাউন্লোড",
      downloading: "ডাউন্লোড হৈ আছে…",
      trying: "চেষ্টা কৰি আছে…",
      downloaded: "সম্পূৰ্ণ",
      error: "ত্ৰুটি",
      failed: "বিফল হ’ল",
      ariaDownload: "ডাউন্লোড",
      titleQuick: "দ্ৰুত ডাউন্লোড",
      comments: "মন্তব্য",
      edited: "সম্পাদিত"
    },
    az: {
      download: "Yüklə",
      downloading: "Yüklənir…",
      trying: "Cəhd edilir…",
      downloaded: "Bitdi",
      error: "Xəta",
      failed: "Alınmadı.",
      ariaDownload: "Yüklə",
      titleQuick: "Sürətli yükləmə",
      comments: "şərh",
      edited: "Düzəliş edilib"
    },
    eu: {
      download: "Deskargatu",
      downloading: "Deskargatzen…",
      trying: "Saiatzen…",
      downloaded: "Eginda",
      error: "Errorea",
      failed: "Huts egin du.",
      ariaDownload: "Deskargatu",
      titleQuick: "Deskarga azkarra",
      comments: "iruzkin",
      edited: "Editatua"
    },
    my: {
      download: "ဒေါင်းလုဒ်",
      downloading: "ဒေါင်းလုဒ် လုပ်နေ…",
      trying: "ကြိုးစားနေ…",
      downloaded: "ပြီးပါပြီ",
      error: "အမှား",
      failed: "မအောင်မြင်ပါ။",
      ariaDownload: "ဒေါင်းလုဒ်",
      titleQuick: "အမြန် ဒေါင်းလုဒ်",
      comments: "မှတ်ချက်များ",
      edited: "ပြင်ဆင်ပြီး"
    },
    gl: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Tentando…",
      downloaded: "Descargado",
      error: "Erro",
      failed: "Fallou.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    ka: {
      download: "ჩამოტვირთვა",
      downloading: "იწერება…",
      trying: "მცდელობა…",
      downloaded: "დასრულდა",
      error: "შეცდომა",
      failed: "ვერ მოხერხდა.",
      ariaDownload: "ჩამოტვირთვა",
      titleQuick: "სწრაფი ჩამოტვირთვა",
      comments: "კომენტარი",
      edited: "რედაქტირებულია"
    },
    is: {
      download: "Sækja",
      downloading: "Sækir…",
      trying: "Reyni…",
      downloaded: "Sótt",
      error: "Villa",
      failed: "Mistókst.",
      ariaDownload: "Sækja",
      titleQuick: "Flýtiniðurhal",
      comments: "ummæli",
      edited: "Breytt"
    },
    ga: {
      download: "Íoslódáil",
      downloading: "Ag íoslódáil…",
      trying: "Ag iarraidh…",
      downloaded: "Íoslódáilte",
      error: "Earráid",
      failed: "Theip air.",
      ariaDownload: "Íoslódáil",
      titleQuick: "Íoslódáil tapa",
      comments: "trácht",
      edited: "Eagraithe"
    },
    kk: {
      download: "Жүктеп алу",
      downloading: "Жүктелуде…",
      trying: "Әрекет…",
      downloaded: "Аяқталды",
      error: "Қате",
      failed: "Сәтсіз.",
      ariaDownload: "Жүктеп алу",
      titleQuick: "Жылдам жүктеу",
      comments: "пікір",
      edited: "Өзгертілді"
    },
    km: {
      download: "ទាញយក",
      downloading: "កំពុងទាញយក…",
      trying: "កំពុងព្យាយាម…",
      downloaded: "បានបញ្ចប់",
      error: "កំហុស",
      failed: "បរាជ័យ",
      ariaDownload: "ទាញយក",
      titleQuick: "ទាញយកលឿន",
      comments: "មតិ",
      edited: "បានកែសម្រួល"
    },
    lo: {
      download: "ດາວໂຫລດ",
      downloading: "ກຳລັງດາວໂຫລດ…",
      trying: "ກຳລັງພະຍາຍາມ…",
      downloaded: "ສຳເລັດ",
      error: "ຜິດພາດ",
      failed: "ລົ້ມເຫລວ",
      ariaDownload: "ດາວໂຫລດ",
      titleQuick: "ດາວໂຫລດດ່ວນ",
      comments: "ຄຳເຫັນ",
      edited: "ແກ້ໄຂແລ້ວ"
    },
    mk: {
      download: "Преземи",
      downloading: "Преземање…",
      trying: "Се обидувам…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преземи",
      titleQuick: "Брзо преземање",
      comments: "коментари",
      edited: "Изменето"
    },
    mn: {
      download: "Татах",
      downloading: "Татаж байна…",
      trying: "Орлдож байна…",
      downloaded: "Татсан",
      error: "Алдаа",
      failed: "Амжилтгүй.",
      ariaDownload: "Татах",
      titleQuick: "Хурдан татах",
      comments: "сэтгэгдэл",
      edited: "Зассан"
    },
    ne: {
      download: "डाउनलोड",
      downloading: "डाउनलोड हुँदै…",
      trying: "प्रयास गर्दै…",
      downloaded: "पूरा भयो",
      error: "त्रुटि",
      failed: "असफल भयो",
      ariaDownload: "डाउनलोड",
      titleQuick: "छिटो डाउनलोड",
      comments: "टिप्पणीहरू",
      edited: "सम्पादित"
    },
    or: {
      download: "ଡାଉନଲୋଡ୍",
      downloading: "ଡାଉନଲୋଡ୍ ହେଉଛି…",
      trying: "ଚେଷ୍ଟା କରୁଛି…",
      downloaded: "ସମ୍ପୂର୍ଣ୍ଣ",
      error: "ତ୍ରୁଟି",
      failed: "ବିଫଳ ହେଲା",
      ariaDownload: "ଡାଉନଲୋଡ୍",
      titleQuick: "ଶୀଘ୍ର ଡାଉନଲୋଡ୍",
      comments: "ମନ୍ତବ୍ୟ",
      edited: "ସମ୍ପାଦିତ"
    },
    si: {
      download: "බාගන්න",
      downloading: "බාගත වෙමින්…",
      trying: "උත්සාහ කරමින්…",
      downloaded: "අවසන්",
      error: "දෝෂයකි",
      failed: "අසාර්ථකයි",
      ariaDownload: "බාගන්න",
      titleQuick: "ඉක්මන් බාගත කිරීම",
      comments: "අදහස්",
      edited: "සංස්කරණය"
    },
    sw: {
      download: "Pakua",
      downloading: "Inapakua…",
      trying: "Inajaribu…",
      downloaded: "Imekamilika",
      error: "Hitilafu",
      failed: "Imeshindwa.",
      ariaDownload: "Pakua",
      titleQuick: "Pakua haraka",
      comments: "maoni",
      edited: "Imehaririwa"
    },
    uz: {
      download: "Yuklash",
      downloading: "Yuklanmoqda…",
      trying: "Urinilmoqda…",
      downloaded: "Tayyor",
      error: "Xato",
      failed: "Muvaffaqiyatsiz.",
      ariaDownload: "Yuklash",
      titleQuick: "Tez yuklash",
      comments: "sharhlar",
      edited: "Tahrirlangan"
    },
    cy: {
      download: "Lawrlwytho",
      downloading: "Yn lawrlwytho…",
      trying: "Yn ceisio…",
      downloaded: "Wedi gorffen",
      error: "Gwall",
      failed: "Methodd.",
      ariaDownload: "Lawrlwytho",
      titleQuick: "Lawrlwytho cyflym",
      comments: "sylwadau",
      edited: "Golygwyd"
    },
    zu: {
      download: "Landa",
      downloading: "Iyalandwa…",
      trying: "Iyazama…",
      downloaded: "Ilandīwe",
      error: "Iphutha",
      failed: "Ihlulekile.",
      ariaDownload: "Landa",
      titleQuick: "Ukulanda okusheshayo",
      comments: "amazwana",
      edited: "Kuhleliwe"
    },
    sq: {
      download: "Shkarko",
      downloading: "Duke shkarkuar…",
      trying: "Duke provuar…",
      downloaded: "Përfundoi",
      error: "Gabim",
      failed: "Dështoi.",
      ariaDownload: "Shkarko",
      titleQuick: "Shkarkim i shpejtë",
      comments: "komente",
      edited: "E redaktuar"
    }
  };
  function t(key) {
    try {
      if (!key || typeof key !== "string") {
        return "...";
      }
      let rawLang = "en";
      if (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) {
        rawLang = document.documentElement.lang;
      } else if (typeof navigator !== "undefined" && navigator.language) {
        rawLang = navigator.language;
      }
      const normalizedLang = rawLang.toLowerCase().split(";")[0].trim().replace("_", "-");
      const baseLang = normalizedLang.split("-")[0];
      if (TRANSLATIONS[normalizedLang] && typeof TRANSLATIONS[normalizedLang][key] === "string") {
        return TRANSLATIONS[normalizedLang][key];
      }
      if (TRANSLATIONS[baseLang] && typeof TRANSLATIONS[baseLang][key] === "string") {
        return TRANSLATIONS[baseLang][key];
      }
      if (TRANSLATIONS["en"] && typeof TRANSLATIONS["en"][key] === "string") {
        return TRANSLATIONS["en"][key];
      }
      return key;
    } catch {
      try {
        return TRANSLATIONS["en"][key] || key;
      } catch {
        return String(key || "Download");
      }
    }
  }
  function isPageDark() {
    if (typeof document === "undefined") return false;
    const drScheme = document.documentElement.getAttribute("data-darkreader-scheme");
    if (drScheme === "dark") return true;
    if (drScheme === "light") return false;
    const darkTokens = ["dark", "dark-theme", "theme-dark", "night", "gm3-dark-theme"];
    const htmlClass = (document.documentElement.className || "").toLowerCase();
    const bodyClass = (document.body.className || "").toLowerCase();
    if (darkTokens.some((token) => htmlClass.includes(token) || bodyClass.includes(token))) {
      return true;
    }
    const probeEl = document.querySelector("div[data-stream-item-id]") || document.querySelector('[role="main"]') || document.body;
    const bgColor = getEffectiveBackgroundColor(probeEl);
    const brightness = parseBrightness(bgColor);
    return brightness < 105;
  }
  function getEffectiveBackgroundColor(start) {
    let el = start;
    const isTransparent = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (!isTransparent(bg)) return bg;
      el = el.parentElement;
    }
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const htmlBg = htmlStyle.backgroundColor;
    if (!isTransparent(htmlBg)) return htmlBg;
    return "rgb(255, 255, 255)";
  }
  function parseBrightness(rgbString) {
    const match = rgbString.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) {
      return 255;
    }
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const brightness = Math.sqrt(
      0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
    );
    return brightness;
  }
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const INJECTED_ATTR = "data-cqd-injected";
  const PROCESSED_ATTR = "data-cqd-processed";
  const RESCAN_INTERVAL_MS = 2e3;
  const RESCAN_DEBOUNCE_MS = 200;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 3e3;
  const FEEDBACK_ERROR_MS = 4e3;
  const DRIVE_ANCHOR_SELECTOR = 'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';
  const ATTACHMENT_CONTAINER_SELECTOR = [
    ".KlRXdf",
    ".z3vRcc",
    ".VfPpkd-aPP78e",
    "[data-drive-id]",
    "[data-id][data-item-id]"
  ].join(", ");
  const DRIVE_URL_PATTERNS = [
    /https:\/\/drive\.google\.com\/file\/d\//,
    /https:\/\/drive\.google\.com\/open\?/,
    /https:\/\/drive\.google\.com\/uc\?/,
    /https:\/\/classroom\.google\.com\/drive\//
  ];
  let scanTimeoutId = null;
  let observer = null;
  let nextRequestSeq = 1;
  const pendingButtons = /* @__PURE__ */ new Map();
  function isGoogleClassroom() {
    if (typeof location === "undefined") return false;
    if (location.hostname !== "classroom.google.com") return false;
    return CLASSROOM_URL_PATTERN.test(location.href);
  }
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      window.clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = window.setTimeout(() => {
      scanTimeoutId = null;
      scanForAttachments(document);
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener(
        "DOMContentLoaded",
        () => setupObservers(),
        { once: true }
      );
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const roots = /* @__PURE__ */ new Set();
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        const isInternal = Array.from(m.addedNodes).some(
          (n) => n.nodeType === Node.ELEMENT_NODE && n.hasAttribute(INJECTED_ATTR)
        );
        if (isInternal) continue;
        shouldScan = true;
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            roots.add(node);
          }
        });
      }
      if (shouldScan) {
        if (roots.size === 0) {
          scheduleScan();
        } else {
          roots.forEach((root) => scanForAttachments(root));
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments(root = document) {
    if (!isGoogleClassroom()) return;
    injectSingleFileButtons(root);
  }
  function injectSingleFileButtons(root = document) {
    const anchors = Array.from(
      root.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container) continue;
      if (hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      root.querySelectorAll(
        "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"
      )
    );
    for (const el of metaElements) {
      if (hasInjectedButton(el)) continue;
      const url = findDriveUrl(el);
      if (!url) continue;
      injectButtonIntoAttachment(el, url);
    }
  }
  function hasInjectedButton(container) {
    return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
  }
  function extractDriveUrlFromAnchor(anchor) {
    const href = anchor.href;
    if (!href) return null;
    return DRIVE_URL_PATTERNS.some((re) => re.test(href)) ? href : null;
  }
  function findDriveUrl(element) {
    const nearAnchor = element.querySelector(DRIVE_ANCHOR_SELECTOR) || element.closest(DRIVE_ANCHOR_SELECTOR);
    if (nearAnchor) {
      const href = extractDriveUrlFromAnchor(nearAnchor);
      if (href) return href;
    }
    const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
    if (driveId) {
      return toDownloadUrl(
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
          driveId
        )}`
      );
    }
    return null;
  }
  function getAuthUser() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("authuser")) return params.get("authuser");
    if (params.has("u")) return params.get("u");
    const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
    if (pathMatch) return pathMatch[1];
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    const authUser = getAuthUser();
    try {
      const parsed = new URL(originalUrl, location.href);
      const appendAuth = (u) => {
        if (!authUser) return u;
        const newU = new URL(u);
        if (!newU.searchParams.has("authuser")) {
          newU.searchParams.set("authuser", authUser);
        }
        return newU.toString();
      };
      if (parsed.hostname === "drive.google.com") {
        if (parsed.pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
          return appendAuth(originalUrl);
        }
        const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          return appendAuth(`https://drive.google.com/uc?export=download&id=${fileMatch[1]}`);
        }
        if (parsed.pathname === "/open" || parsed.pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          if (authUser) parsed.searchParams.set("authuser", authUser);
          return parsed.toString();
        }
      }
      if (parsed.hostname === "classroom.google.com" && parsed.pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
      }
      return appendAuth(originalUrl);
    } catch {
      return originalUrl;
    }
  }
  function cleanAttachmentName(rawName) {
    if (!rawName) return "";
    let name = rawName.trim();
    const garbageLabels = ["Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint", "Compressed archive", "Binary", "Unknown", "Google Sheets", "Google Docs", "Google Slides", "Text File", "PDF", "Video", "Image", "Audio", "Text", "Word", "Excel", "PowerPoint", "Archive", "Zip", "File", "Document", "Shortcut", "Code"];
    for (const label of garbageLabels) {
      if (name.endsWith(label)) {
        const potential = name.slice(0, -label.length).trim();
        if (potential.length > 0) {
          name = potential;
          break;
        }
      }
    }
    if (name.length > 0 && name.length % 2 === 0) {
      const mid = name.length / 2;
      if (name.slice(0, mid) === name.slice(mid)) return name.slice(0, mid);
    }
    const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
    const repeatMatch = name.match(repeatRegex);
    if (repeatMatch) return name.slice(0, -repeatMatch[1].length).trim();
    return name;
  }
  function extractFileMeta(container, url) {
    let name;
    const tooltip = container.getAttribute("data-tooltip") || container.getAttribute("aria-label") || container.getAttribute("title");
    if (tooltip && tooltip.trim()) name = tooltip.trim();
    if (!name) {
      const text = (container.textContent || "").trim();
      if (text) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) name = lines[0];
      }
    }
    if (!name) {
      try {
        const u = new URL(url);
        const pathName = decodeURIComponent(u.pathname.split("/").pop() || "");
        if (pathName && pathName.includes(".")) name = pathName;
      } catch {
      }
    }
    if (name) name = cleanAttachmentName(name);
    let ext;
    if (name) {
      const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
      if (m) ext = m[1].toLowerCase();
    }
    return { name, ext, kind: "other" };
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
    container.setAttribute(PROCESSED_ATTR, "true");
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") container.style.position = "relative";
    const directUrl = toDownloadUrl(url);
    const fileMeta = extractFileMeta(container, directUrl);
    const button = createDownloadButton(container, directUrl, fileMeta);
    const iconEl = button.querySelector(".cqd-download-icon");
    if (iconEl) iconEl.classList.add("cqd-icon-medium");
    container.appendChild(button);
  }
  function getButtonState(button) {
    if (button.classList.contains("cqd-loading")) return "loading";
    if (button.classList.contains("cqd-trying")) return "trying";
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state, options) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    const errorDetail = button.querySelector(".cqd-error-detail");
    if (!icon || !label || !errorDetail) return;
    button.classList.remove("cqd-loading", "cqd-trying", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "";
    label.textContent = t("download");
    errorDetail.textContent = "";
    icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
    icon.style.backgroundSize = "";
    switch (state) {
      case "idle":
        break;
      case "loading":
      case "trying": {
        const isTrying = state === "trying";
        button.classList.add(isTrying ? "cqd-trying" : "cqd-loading");
        button.disabled = true;
        label.textContent = isTrying ? t("trying") : t("downloading");
        icon.classList.add("cqd-spinner");
        icon.style.backgroundImage = "none";
        break;
      }
      case "success":
        button.classList.add("cqd-success");
        label.textContent = t("downloaded");
        icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        break;
      case "error":
        button.classList.add("cqd-error");
        label.textContent = t("error");
        icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        errorDetail.textContent = options?.userMessage || t("failed");
        break;
    }
  }
  function setPillProgress(button, fraction) {
    const clamped = Math.max(0, Math.min(1, fraction || 0));
    button.style.setProperty("--cqd-progress", `${clamped * 100}%`);
  }
  function createDownloadButton(_container, url, fileMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    if (isPageDark()) {
      button.classList.add("cqd-theme-dark");
    }
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", `${t("ariaDownload")} ${fileMeta.name || ""}`);
    button.setAttribute("title", t("titleQuick"));
    try {
      if (url) button.dataset.cqdUrl = url;
      if (fileMeta?.name) button.dataset.cqdName = fileMeta.name;
      if (fileMeta?.ext) button.dataset.cqdExt = fileMeta.ext;
    } catch {
    }
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = t("download");
    const errorDetail = document.createElement("span");
    errorDetail.className = "cqd-error-detail";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.appendChild(errorDetail);
    const clickHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    };
    button.addEventListener("click", clickHandler);
    button.addEventListener("auxclick", (e) => {
      if (e.button === 1) clickHandler(e);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url, fileMeta) {
    if (!url) return;
    if (getButtonState(button) !== "idle") return;
    setPillProgress(button, 0);
    const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
    const startedAt = Date.now();
    pendingButtons.set(requestId, { button, requestId, fileMeta, startedAt });
    setButtonState(button, "loading");
    const startResult = await startBackgroundDownload(requestId, url, fileMeta);
    if (!startResult.ok) {
      pendingButtons.delete(requestId);
      await ensureMinLoading(startedAt);
      await showErrorState(button, startResult.userMessage);
      return;
    }
  }
  function startBackgroundDownload(requestId, url, fileMeta) {
    const finalUrl = toDownloadUrl(url);
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve({ ok: false, userMessage: "Runtime not available." });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "CQD_DOWNLOAD", url: finalUrl, requestId, fileMeta },
          (response) => {
            if (chrome.runtime.lastError || !response || response.started === false) {
              resolve({ ok: false, userMessage: response?.userMessage || "Could not start." });
            } else {
              resolve({ ok: true });
            }
          }
        );
      } catch {
        resolve({ ok: false, userMessage: "Comm error." });
      }
    });
  }
  async function showErrorState(button, userMessage) {
    setButtonState(button, "error", { userMessage });
    const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
    while (true) {
      await delay(200);
      if (getButtonState(button) !== "error") return;
      if (Date.now() < earliestReset) continue;
      if (!button.matches(":hover")) {
        setButtonState(button, "idle");
        setPillProgress(button, 0);
        return;
      }
    }
  }
  async function ensureMinLoading(startedAt) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < LOADING_MIN_MS) await delay(LOADING_MIN_MS - elapsed);
  }
  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "CQD_DOWNLOAD_STATUS") return;
      const requestId = message.requestId;
      if (!requestId) return;
      const pending = pendingButtons.get(requestId);
      if (!pending) return;
      const { button, startedAt } = pending;
      (async () => {
        await ensureMinLoading(startedAt);
        const status = message.status;
        const errorCode = message.errorCode;
        const userMessage = message.userMessage;
        if (status === "trying") {
          setButtonState(button, "trying", { userMessage });
          return;
        }
        if (status === "success" || status === "complete") {
          pendingButtons.delete(requestId);
          try {
            button.dataset.cqdAllDone = "true";
          } catch {
          }
          setPillProgress(button, 1);
          setButtonState(button, "success");
          await waitForSuccessReset(button);
          return;
        }
        if (status === "error" || status === "interrupted" || status === "blocked_html") {
          if (errorCode === "AUTH_CHECK") {
            await showErrorState(button, userMessage);
            return;
          }
          pendingButtons.delete(requestId);
          setPillProgress(button, 0);
          await showErrorState(button, userMessage);
        }
      })();
    });
  }
  function initContentScript() {
    if (!isGoogleClassroom()) return;
    injectStyles();
    setupObservers();
  }
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      initContentScript();
    }
  });
  async function waitForSuccessReset(button) {
    const earliestReset = Date.now() + FEEDBACK_SUCCESS_MS;
    while (true) {
      await delay(200);
      if (getButtonState(button) !== "success") {
        return;
      }
      if (Date.now() < earliestReset) continue;
      const postRoot = button.closest("div[data-stream-item-id]") || button.closest("main") || button.closest('div[role="main"]');
      if (postRoot && postRoot.dataset.cqdGroupActive === "1") {
        continue;
      }
      if (button.matches(":hover")) continue;
      break;
    }
    setButtonState(button, "idle");
    setPillProgress(button, 0);
    try {
      delete button.dataset.cqdAllDone;
    } catch {
    }
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9pbmRleC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtaWNvbiB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLXNtYWxsIHtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAxNnB4IDE2cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLW1lZGl1bSB7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1sYXJnZSB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMzJweCAzMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXgtd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXJnaW4tbGVmdCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgd2lkdGg6IDE1MHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcge1xuICAgICAgd2lkdGg6IDExMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXRyeWluZyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcgLmNxZC1sYWJlbCxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICB3aWR0aDogOTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIG1heC13aWR0aDogMTUwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA0MHB4O1xuICAgICAgcGFkZGluZy10b3A6IDA7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogMDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aGl0ZS1zcGFjZTogbm9ybWFsO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciB7XG4gICAgICB3aWR0aDogMzUwcHg7XG4gICAgICBtYXgtd2lkdGg6IDM2MHB4O1xuICAgICAgaGVpZ2h0OiA2MHB4O1xuICAgICAgbWF4LWhlaWdodDogNjFweDtcbiAgICAgIHBhZGRpbmc6IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA3cHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDYwcHg7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDIuIENPTU1FTlRTICYgRURJVEVEIChPdmVybGF5KVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgei1pbmRleDogMTA7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtY29sb3ItY29tbWVudCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoOTksIDEwMiwgMjQxLCAwLjUpO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwcHgpO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kaWZmLXZhbCB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF1bZGF0YS1jcWQtcHJvY2Vzc2VkXVtkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkXSA+IC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNGRjQwMzYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogNzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGRjQwMzY7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHBhZGRpbmctdG9wOiA4cHg7XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtc2VjdGlvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbiB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24tZWRpdGVkIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1wbHVzIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgIG1hcmdpbjogNXB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSxcbiAgICAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXgtaGVpZ2h0IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1hcmdpbi10b3AgMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogMTIwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OIChIZWFkZXItYWxpZ25lZClcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICAgICAgLyogUHJvZ3Jlc3MgY29udHJvbCAoMCUgdG8gMTAwJSkgKi9cbiAgICAgIC0tY3FkLXByb2dyZXNzOiAwJTtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMTJweDtcbiAgICAgIHJpZ2h0OiA0OHB4O1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgei1pbmRleDogNjtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgcGFkZGluZzogNHB4IDEycHg7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgZ2FwOiA2cHg7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xcyBlYXNlLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWigwKTtcbiAgICB9XG5cbiAgICAvKiBXaGVuIGluamVjdGVkIGludG8gdGhlIGhlYWRlciBmbGV4IHN0cnVjdHVyZSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtaW4taGVhZGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHRvcDogYXV0bztcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogYXV0bztcbiAgICAgIGJvdHRvbTogYXV0bztcbiAgICAgIHRyYW5zZm9ybTogbm9uZTtcbiAgICAgIFxuICAgICAgLyogSW1wb3J0YW50OiBNYXJnaW4gdG8gc2VwYXJhdGUgZnJvbSB0aGUgXCJUaHJlZSBEb3RzXCIgbWVudSAqL1xuICAgICAgbWFyZ2luLWlubGluZS1lbmQ6IDhweDtcbiAgICAgIFxuICAgICAgLyogRW5zdXJlIGl0IGRvZXNuJ3QgZ2V0IGNydXNoZWQgaW4gZmxleCByb3dzICovXG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAvKiBSVEwgZmFsbGJhY2sgb25seSBmb3Igbm9uLWhlYWRlciBjYXNlcyAoYWJzb2x1dGUgcG9zaXRpb25lZCBhdCB0b3AgY29ybmVyKSAqL1xuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0bjpub3QoLmNxZC1pbi1oZWFkZXIpIHtcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogNDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLyogS2VlcCBwb2ludGVyIGN1cnNvciBldmVuIHdoaWxlIGRpc2FibGVkICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuW2Rpc2FibGVkXSB7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLyogRlVMTCBTVUNDRVNTIFNUQVRFIChTb2xpZCBHcmVlbikgKi9cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtZXJyb3Ige1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgIH1cblxuICAgIC8qIFBST0dSRVNTIEJBUiBPVkVSTEFZIChGaWxscyB1cCkgKi9cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46OmFmdGVyIHtcbiAgICAgIGNvbnRlbnQ6ICcnO1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHotaW5kZXg6IDA7XG5cbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcblxuICAgICAgLyogV2lkdGggY29udHJvbGxlZCBieSBKUyAqL1xuICAgICAgd2lkdGg6IHZhcigtLWNxZC1wcm9ncmVzcyk7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCAwLjNzIGN1YmljLWJlemllcigwLjIyLCAwLjYxLCAwLjM2LCAxKTtcblxuICAgICAgb3BhY2l0eTogMTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzOjphZnRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgIH1cblxuICAgIC8qIENvbnRlbnQgbGF5ZXJzICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4sXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YixcbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMThweCAxOHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIG9wYWNpdHk6IDAuOTtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gIGAudHJpbSgpO1xuXG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufSIsImNvbnN0IFRSQU5TTEFUSU9OUzogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgZW46IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ0Rvd25sb2FkaW5n4oCmJyxcbiAgICB0cnlpbmc6ICdUcnlpbmfigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEb3dubG9hZGVkJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdEb3dubG9hZCBmYWlsZWQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ1F1aWNrIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRzJyxcbiAgICBlZGl0ZWQ6ICdFZGl0ZWQnLFxuICAgIGRvd25sb2FkQWxsOiAnRG93bmxvYWQgYWxsJyxcbiAgfSxcbiAgYXI6IHtcbiAgICBkb3dubG9hZDogJ9iq2YbYstmK2YQnLFxuICAgIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLFxuICAgIHRyeWluZzogJ9mF2K3Yp9mI2YTYqeKApicsXG4gICAgZG93bmxvYWRlZDogJ9iq2YUg2KfZhNiq2YbYstmK2YQnLFxuICAgIGVycm9yOiAn2K7Yt9ijJyxcbiAgICBmYWlsZWQ6ICfZgdi02YQg2KfZhNiq2YbYstmK2YQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfYqtmG2LLZitmEJyxcbiAgICB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsXG4gICAgY29tbWVudHM6ICfYqti52YTZitmC2KfYqicsXG4gICAgZWRpdGVkOiAn2KrZhSDYp9mE2KrYudiv2YrZhCcsXG4gICAgZG93bmxvYWRBbGw6ICfYqtmG2LLZitmEINin2YTZg9mEJyxcbiAgfSxcbiAgamE6IHtcbiAgICBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsXG4gICAgZG93bmxvYWRpbmc6ICdETOS4reKApicsXG4gICAgdHJ5aW5nOiAn6Kmm6KGM5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5a6M5LqGJyxcbiAgICBlcnJvcjogJ+OCqOODqeODvCcsXG4gICAgZmFpbGVkOiAn5aSx5pWX44GX44G+44GX44Gf44CCJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIHRpdGxlUXVpY2s6ICfjgq/jgqTjg4Pjgq/jg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIGNvbW1lbnRzOiAn5Lu244Gu44Kz44Oh44Oz44OIJyxcbiAgICBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nLFxuICB9LFxuICBlczoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdJbnRlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnRmFsbMOzIGxhIGRlc2NhcmdhLicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gIGhpOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KSh4KS/4KSC4KSX4oCmJyxcbiAgICB0cnlpbmc6ICfgpJXgpYvgpLbgpL/gpLYg4KSc4KS+4KSw4KWA4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+CkvycsXG4gICAgZmFpbGVkOiAn4KS14KS/4KSr4KSyIOCksOCkueCkvicsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpL/gpK/gpL7gpIEnLFxuICAgIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIHB0OiB7XG4gICAgZG93bmxvYWQ6ICdCYWl4YXInLFxuICAgIGRvd25sb2FkaW5nOiAnQmFpeGFuZG/igKYnLFxuICAgIHRyeWluZzogJ1RlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQmFpeGFkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxoYSBhbyBiYWl4YXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByw6FwaWRvJyxcbiAgICBjb21tZW50czogJ2NvbWVudMOhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gICdwdC1wdCc6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0EgZGVzY2FycmVnYXLigKYnLFxuICAgIHRyeWluZzogJ0EgdGVudGFy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGhhIGFvIGRlc2NhcnJlZ2FyLicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudMOhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gICd6aC1jbic6IHtcbiAgICBkb3dubG9hZDogJ+S4i+i9vScsXG4gICAgZG93bmxvYWRpbmc6ICfkuIvovb3kuK3igKYnLFxuICAgIHRyeWluZzogJ+WwneivleS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsXG4gICAgZXJyb3I6ICfplJnor68nLFxuICAgIGZhaWxlZDogJ+S4i+i9veWksei0pScsXG4gICAgYXJpYURvd25sb2FkOiAn5LiL6L29JyxcbiAgICB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6L29JyxcbiAgICBjb21tZW50czogJ+adoeivhOiuuicsXG4gICAgZWRpdGVkOiAn5bey57yW6L6RJyxcbiAgfSxcbiAgJ3poLXR3Jzoge1xuICAgIGRvd25sb2FkOiAn5LiL6LyJJyxcbiAgICBkb3dubG9hZGluZzogJ+S4i+i8ieS4reKApicsXG4gICAgdHJ5aW5nOiAn5ZiX6Kmm5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5bey5LiL6LyJJyxcbiAgICBlcnJvcjogJ+mMr+iqpCcsXG4gICAgZmFpbGVkOiAn5LiL6LyJ5aSx5pWXJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfkuIvovIknLFxuICAgIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovIknLFxuICAgIGNvbW1lbnRzOiAn5YmH55WZ6KiAJyxcbiAgICBlZGl0ZWQ6ICflt7Lnt6jovK8nLFxuICB9LFxuICBmcjoge1xuICAgIGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsXG4gICAgZG93bmxvYWRpbmc6ICdUw6lsw6ljaGFyZ2VtZW504oCmJyxcbiAgICB0cnlpbmc6ICdFc3NhaeKApicsXG4gICAgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLFxuICAgIGVycm9yOiAnRXJyZXVyJyxcbiAgICBmYWlsZWQ6ICfDiWNoZWMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJyxcbiAgICB0aXRsZVF1aWNrOiAnVMOpbMOpY2hhcmdlbWVudCByYXBpZGUnLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudGFpcmVzJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmnDqScsXG4gIH0sXG4gIGRlOiB7XG4gICAgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGVu4oCmJyxcbiAgICB0cnlpbmc6ICdWZXJzdWNoZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLFxuICAgIGVycm9yOiAnRmVobGVyJyxcbiAgICBmYWlsZWQ6ICdGZWhsZ2VzY2hsYWdlbi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLFxuICAgIHRpdGxlUXVpY2s6ICdTY2huZWxsZXIgRG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnS29tbWVudGFyZScsXG4gICAgZWRpdGVkOiAnQmVhcmJlaXRldCcsXG4gIH0sXG4gIGl0OiB7XG4gICAgZG93bmxvYWQ6ICdTY2FyaWNhJyxcbiAgICBkb3dubG9hZGluZzogJ1NjYXJpY2FtZW50b+KApicsXG4gICAgdHJ5aW5nOiAnUHJvdmFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLFxuICAgIGVycm9yOiAnRXJyb3JlJyxcbiAgICBmYWlsZWQ6ICdGYWxsaXRvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU2NhcmljYScsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIHJhcGlkbycsXG4gICAgY29tbWVudHM6ICdjb21tZW50aScsXG4gICAgZWRpdGVkOiAnTW9kaWZpY2F0bycsXG4gIH0sXG4gIHJ1OiB7XG4gICAgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsXG4gICAgZG93bmxvYWRpbmc6ICfQodC60LDRh9C40LLQsNC90LjQteKApicsXG4gICAgdHJ5aW5nOiAn0J/QvtC/0YvRgtC60LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsXG4gICAgZXJyb3I6ICfQntGI0LjQsdC60LAnLFxuICAgIGZhaWxlZDogJ9Ch0LHQvtC5LicsXG4gICAgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGL0YHRgtGA0L7QtSDRgdC60LDRh9C40LLQsNC90LjQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQvNC10L3RgtCw0YDQuNC10LInLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nLFxuICB9LFxuICBrbzoge1xuICAgIGRvd25sb2FkOiAn64uk7Jq066Gc65OcJyxcbiAgICBkb3dubG9hZGluZzogJ+uLpOyatOuhnOuTnCDspJHigKYnLFxuICAgIHRyeWluZzogJ+yLnOuPhCDspJHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfsmYTro4wnLFxuICAgIGVycm9yOiAn7Jik66WYJyxcbiAgICBmYWlsZWQ6ICfsi6TtjKjtlagnLFxuICAgIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsXG4gICAgdGl0bGVRdWljazogJ+u5oOuluCDri6TsmrTroZzrk5wnLFxuICAgIGNvbW1lbnRzOiAn6rCcIOuMk+q4gCcsXG4gICAgZWRpdGVkOiAn7IiY7KCV65CoJyxcbiAgfSxcbiAgdHI6IHtcbiAgICBkb3dubG9hZDogJ8SwbmRpcicsXG4gICAgZG93bmxvYWRpbmc6ICfEsG5kaXJpbGl5b3LigKYnLFxuICAgIHRyeWluZzogJ0RlbmVuaXlvcuKApicsXG4gICAgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLFxuICAgIGVycm9yOiAnSGF0YScsXG4gICAgZmFpbGVkOiAnQmHFn2FyxLFzxLF6LicsXG4gICAgYXJpYURvd25sb2FkOiAnxLBuZGlyJyxcbiAgICB0aXRsZVF1aWNrOiAnSMSxemzEsSBpbmRpcicsXG4gICAgY29tbWVudHM6ICd5b3J1bScsXG4gICAgZWRpdGVkOiAnRMO8emVubGVuZGknLFxuICB9LFxuICB2aToge1xuICAgIGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsXG4gICAgZG93bmxvYWRpbmc6ICfEkGFuZyB04bqjaeKApicsXG4gICAgdHJ5aW5nOiAnxJBhbmcgdGjhu63igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJyxcbiAgICBlcnJvcjogJ0zhu5dpJyxcbiAgICBmYWlsZWQ6ICdUaOG6pXQgYuG6oWkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJyxcbiAgICB0aXRsZVF1aWNrOiAnVOG6o2kgeHXhu5FuZyBuaGFuaCcsXG4gICAgY29tbWVudHM6ICduaOG6rW4geMOpdCcsXG4gICAgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyxcbiAgfSxcbiAgaWQ6IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ01lbmd1bmR1aOKApicsXG4gICAgdHJ5aW5nOiAnTWVuY29iYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1NlbGVzYWknLFxuICAgIGVycm9yOiAnS2VzYWxhaGFuJyxcbiAgICBmYWlsZWQ6ICdHYWdhbC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgY2VwYXQnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXInLFxuICAgIGVkaXRlZDogJ0RpZWRpdCcsXG4gIH0sXG4gIHRoOiB7XG4gICAgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLFxuICAgIGRvd25sb2FkaW5nOiAn4LiB4Liz4Lil4Lix4LiH4LmC4Lir4Lil4LiU4oCmJyxcbiAgICB0cnlpbmc6ICfguJ7guKLguLLguKLguLLguKHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLFxuICAgIGVycm9yOiAn4LiC4LmJ4Lit4Lic4Li04LiU4Lie4Lil4Liy4LiUJyxcbiAgICBmYWlsZWQ6ICfguKXguYnguKHguYDguKvguKXguKcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsXG4gICAgdGl0bGVRdWljazogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lOC4lOC5iOC4p+C4mScsXG4gICAgY29tbWVudHM6ICfguITguKfguLLguKHguITguLTguJTguYDguKvguYfguJknLFxuICAgIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycsXG4gIH0sXG4gIHBsOiB7XG4gICAgZG93bmxvYWQ6ICdQb2JpZXJ6JyxcbiAgICBkb3dubG9hZGluZzogJ1BvYmllcmFuaWXigKYnLFxuICAgIHRyeWluZzogJ1Byw7NiYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1BvYnJhbm8nLFxuICAgIGVycm9yOiAnQsWCxIVkJyxcbiAgICBmYWlsZWQ6ICdOaWV1ZGFuZS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLFxuICAgIHRpdGxlUXVpY2s6ICdTenlia2llIHBvYmllcmFuaWUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJ6ZScsXG4gICAgZWRpdGVkOiAnRWR5dG93YW5vJyxcbiAgfSxcbiAgbmw6IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLFxuICAgIGRvd25sb2FkaW5nOiAnRG93bmxvYWRlbuKApicsXG4gICAgdHJ5aW5nOiAnUHJvYmVyZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFhcicsXG4gICAgZXJyb3I6ICdGb3V0JyxcbiAgICBmYWlsZWQ6ICdNaXNsdWt0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsXG4gICAgdGl0bGVRdWljazogJ1NuZWwgZG93bmxvYWRlbicsXG4gICAgY29tbWVudHM6ICdyZWFjdGllcycsXG4gICAgZWRpdGVkOiAnQmV3ZXJrdCcsXG4gIH0sXG4gIGJuOiB7XG4gICAgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahIOCmueCmmuCnjeCmm+Cnh+KApicsXG4gICAgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCmsOCmm+Cnh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsXG4gICAgZXJyb3I6ICfgpqTgp43gprDgp4Hgpp/gpr8nLFxuICAgIGZhaWxlZDogJ+CmrOCnjeCmr+CmsOCnjeCmpSDgprngpq/gprzgp4fgppvgp4cnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgdGl0bGVRdWljazogJ+CmpuCnjeCmsOCngeCmpCDgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIGNvbW1lbnRzOiAn4Kaf4Ka/IOCmruCmqOCnjeCmpOCmrOCnjeCmrycsXG4gICAgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyxcbiAgfSxcbiAgcGE6IHtcbiAgICBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgZG93bmxvYWRpbmc6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEg4Ki54KmLIOCosOCov+CoueCovuKApicsXG4gICAgdHJ5aW5nOiAn4KiV4KmL4Ki44Ki84Ki/4Ki44Ki8IOConOCovuCosOCpgOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsXG4gICAgZXJyb3I6ICfgqJfgqLLgqKTgqYAnLFxuICAgIGZhaWxlZDogJ+CoheCouOCoq+CosicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kik4KmH4Kic4Ki8IOCooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgY29tbWVudHM6ICfgqJ/gqL/gqbHgqKrgqKPgqYDgqIbgqIInLFxuICAgIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcsXG4gIH0sXG4gIHRlOiB7XG4gICAgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNIOCwheCwteCxgeCwpOCxi+CwguCwpuCwv+KApicsXG4gICAgdHJ5aW5nOiAn4LCq4LGN4LCw4LCv4LCk4LGN4LCo4LC/4LC44LGN4LCk4LGL4LCC4LCm4LC/4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JyxcbiAgICBlcnJvcjogJ+CwsuCxi+CwquCwgicsXG4gICAgZmFpbGVkOiAn4LC14LC/4LCr4LCy4LCu4LGI4LCC4LCm4LC/JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgsKTgsY3gsLXgsLDgsL/gsKQg4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICBjb21tZW50czogJ+CwteCxjeCwr+CwvuCwluCxjeCwr+CwsuCxgScsXG4gICAgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyxcbiAgfSxcbiAgbXI6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWL4KSkIOCkhuCkueClh+KApicsXG4gICAgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KSk4KWN4KSoIOCkleCksOCkpCDgpIbgpLngpYfigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KWAJyxcbiAgICBmYWlsZWQ6ICfgpIXgpK/gpLbgpLjgpY3gpLXgpYAnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWN4KSv4KS+JyxcbiAgICBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICB0YToge1xuICAgIGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJyxcbiAgICBkb3dubG9hZGluZzogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuquCvjeCuquCun+CvgeCuleCuv+CuseCupOCvgeKApicsXG4gICAgdHJ5aW5nOiAn4K6u4K+B4K6v4K6x4K+N4K6a4K6/4K6V4K+N4K6V4K6/4K6x4K6k4K+B4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJyxcbiAgICBlcnJvcjogJ+CuquCuv+CutOCviCcsXG4gICAgZmFpbGVkOiAn4K6k4K+L4K6y4K+N4K614K6/JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLFxuICAgIHRpdGxlUXVpY2s6ICfgrrXgrr/grrDgr4jgrrXgr4Eg4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K6u4K+NJyxcbiAgICBjb21tZW50czogJ+CuleCusOCvgeCupOCvjeCupOCvgeCuleCus+CvjScsXG4gICAgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyxcbiAgfSxcbiAgdXI6IHtcbiAgICBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsXG4gICAgZG93bmxvYWRpbmc6ICfaiNin2KTZhiDZhNmI2ogg24HZiCDYsduB2Kcg24HbkuKApicsXG4gICAgdHJ5aW5nOiAn2qnZiNi02LQg2KzYp9ix24zigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsXG4gICAgZXJyb3I6ICfYutmE2LfbjCcsXG4gICAgZmFpbGVkOiAn2YbYp9qp2KfZhScsXG4gICAgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJyxcbiAgICB0aXRsZVF1aWNrOiAn2YHZiNix24wg2ojYp9ik2YYg2YTZiNqIJyxcbiAgICBjb21tZW50czogJ9iq2KjYtdix25InLFxuICAgIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyxcbiAgfSxcbiAgZ3U6IHtcbiAgICBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgZG93bmxvYWRpbmc6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEg4Kql4KqIIOCqsOCqueCrjeCqr+CrgeCqgiDgqpvgq4figKYnLFxuICAgIHRyeWluZzogJ+CqquCrjeCqsOCqr+CqvuCquCDgqprgqr7gqrLgq4HigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLFxuICAgIGVycm9yOiAn4Kqt4KuC4KqyJyxcbiAgICBmYWlsZWQ6ICfgqqjgqr/gqrfgq43gqqvgqrMnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgdGl0bGVRdWljazogJ+CqneCqoeCqquCrgCDgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIGNvbW1lbnRzOiAn4Kqf4Kq/4Kqq4KuN4Kqq4Kqj4KuA4KqTJyxcbiAgICBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnLFxuICB9LFxuICBrbjoge1xuICAgIGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICBkb3dubG9hZGluZzogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjSDgsobgspfgs4HgsqTgs43gsqTgsr/gsqbgs4bigKYnLFxuICAgIHRyeWluZzogJ+CyquCzjeCysOCyr+CypOCzjeCyqOCyv+CyuOCzgeCypOCzjeCypOCyv+CypuCzhuKApicsXG4gICAgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsXG4gICAgZXJyb3I6ICfgsqbgs4vgsrcnLFxuICAgIGZhaWxlZDogJ+CyteCyv+Cyq+CysuCyteCyvuCyl+Cyv+CypuCzhicsXG4gICAgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICB0aXRsZVF1aWNrOiAn4LKk4LON4LK14LKw4LK/4LKkIOCyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgY29tbWVudHM6ICfgspXgsr7gsq7gs4bgsoLgsp/gs43igIzgspfgsrPgs4EnLFxuICAgIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicsXG4gIH0sXG4gIG1sOiB7XG4gICAgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNIOC0muC1huC0r+C1jeC0r+C1geC0qOC1jeC0qOC1geKApicsXG4gICAgdHJ5aW5nOiAn4LS24LWN4LSw4LSu4LS/4LSV4LWN4LSV4LWB4LSo4LWN4LSo4LWB4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JyxcbiAgICBlcnJvcjogJ+C0quC0v+C0tuC0leC1jScsXG4gICAgZmFpbGVkOiAn4LSq4LSw4LS+4LSc4LSv4LSq4LWN4LSq4LWG4LSf4LWN4LSf4LWBJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgtLXgtYfgtJfgtKTgtY3gtKTgtL/gtb0g4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICBjb21tZW50czogJ+C0heC0reC0v+C0quC1jeC0sOC0vuC0r+C0meC1jeC0meC1vicsXG4gICAgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyxcbiAgfSxcbiAgdWs6IHtcbiAgICBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0JfQsNCy0LDQvdGC0LDQttC10L3QvdGP4oCmJyxcbiAgICB0cnlpbmc6ICfQodC/0YDQvtCx0LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0J/QvtC80LjQu9C60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXQstC00LDRh9CwLicsXG4gICAgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsXG4gICAgdGl0bGVRdWljazogJ9Co0LLQuNC00LrQtSDQt9Cw0LLQsNC90YLQsNC20LXQvdC90Y8nLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNGW0LInLFxuICAgIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyxcbiAgfSxcbiAgZWw6IHtcbiAgICBkb3dubG9hZDogJ86bzq7PiM63JyxcbiAgICBkb3dubG9hZGluZzogJ86bzq7PiM634oCmJyxcbiAgICB0cnlpbmc6ICfOoM+Bzr/Pg8+AzqzOuM61zrnOseKApicsXG4gICAgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsXG4gICAgZXJyb3I6ICfOo8+GzqzOu868zrEnLFxuICAgIGZhaWxlZDogJ86Rz4DOrc+Ez4XPh861LicsXG4gICAgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLFxuICAgIHRpdGxlUXVpY2s6ICfOk8+Bzq7Os86/z4HOtyDOu86uz4jOtycsXG4gICAgY29tbWVudHM6ICfPg8+Hz4zOu865zrEnLFxuICAgIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyxcbiAgfSxcbiAgY3M6IHtcbiAgICBkb3dubG9hZDogJ1N0w6Fobm91dCcsXG4gICAgZG93bmxvYWRpbmc6ICdTdGFob3bDoW7DreKApicsXG4gICAgdHJ5aW5nOiAnWmtvdcWhw61t4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLFxuICAgIGVycm9yOiAnQ2h5YmEnLFxuICAgIGZhaWxlZDogJ1NlbGhhbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLFxuICAgIHRpdGxlUXVpY2s6ICdSeWNobMOpIHN0YcW+ZW7DrScsXG4gICAgY29tbWVudHM6ICdrb21lbnTDocWZxa8nLFxuICAgIGVkaXRlZDogJ1VwcmF2ZW5vJyxcbiAgfSxcbiAgcm86IHtcbiAgICBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsXG4gICAgZG93bmxvYWRpbmc6ICdTZSBkZXNjYXJjxIPigKYnLFxuICAgIHRyeWluZzogJ1NlIMOubmNlYXJjxIPigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLFxuICAgIGVycm9yOiAnRXJvYXJlJyxcbiAgICBmYWlsZWQ6ICdFyJl1YXQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjxINyY2FyZSByYXBpZMSDJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaWknLFxuICAgIGVkaXRlZDogJ01vZGlmaWNhdCcsXG4gIH0sXG4gIGh1OiB7XG4gICAgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJyxcbiAgICBkb3dubG9hZGluZzogJ0xldMO2bHTDqXPigKYnLFxuICAgIHRyeWluZzogJ1Byw7Niw6Fsa296w6Fz4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS8Opc3onLFxuICAgIGVycm9yOiAnSGliYScsXG4gICAgZmFpbGVkOiAnU2lrZXJ0ZWxlbi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLFxuICAgIHRpdGxlUXVpY2s6ICdHeW9ycyBsZXTDtmx0w6lzJyxcbiAgICBjb21tZW50czogJ21lZ2plZ3l6w6lzJyxcbiAgICBlZGl0ZWQ6ICdTemVya2VzenR2ZScsXG4gIH0sXG4gIHN2OiB7XG4gICAgZG93bmxvYWQ6ICdMYWRkYSBuZXInLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkZGFyIG5lcuKApicsXG4gICAgdHJ5aW5nOiAnRsO2cnPDtmtlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYXJ0JyxcbiAgICBlcnJvcjogJ0ZlbCcsXG4gICAgZmFpbGVkOiAnTWlzc2x5Y2thZGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJyxcbiAgICB0aXRsZVF1aWNrOiAnU25hYmIgbmVkbGFkZG5pbmcnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJhZCcsXG4gIH0sXG4gIGRhOiB7XG4gICAgZG93bmxvYWQ6ICdIZW50JyxcbiAgICBkb3dubG9hZGluZzogJ0hlbnRlcuKApicsXG4gICAgdHJ5aW5nOiAnUHLDuHZlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0hlbnRldCcsXG4gICAgZXJyb3I6ICdGZWpsJyxcbiAgICBmYWlsZWQ6ICdNaXNseWtrZWRlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0hlbnQnLFxuICAgIHRpdGxlUXVpY2s6ICdIdXJ0aWcgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJldCcsXG4gIH0sXG4gIGZpOiB7XG4gICAgZG93bmxvYWQ6ICdMYXRhYScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRhdGFhbuKApicsXG4gICAgdHJ5aW5nOiAnWXJpdGV0w6TDpG7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdMYWRhdHR1JyxcbiAgICBlcnJvcjogJ1ZpcmhlJyxcbiAgICBmYWlsZWQ6ICdFcMOkb25uaXN0dWkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXRhYScsXG4gICAgdGl0bGVRdWljazogJ1Bpa2FsYXRhdXMnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudHRpYScsXG4gICAgZWRpdGVkOiAnTXVva2F0dHUnLFxuICB9LFxuICBubzoge1xuICAgIGRvd25sb2FkOiAnTGFzdCBuZWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFzdGVyIG5lZOKApicsXG4gICAgdHJ5aW5nOiAnUHLDuHZlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0ZlcmRpZycsXG4gICAgZXJyb3I6ICdGZWlsJyxcbiAgICBmYWlsZWQ6ICdNaXNseWt0ZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsXG4gICAgdGl0bGVRdWljazogJ1Jhc2sgbmVkbGFzdGluZycsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcnQnLFxuICB9LFxuICBoZToge1xuICAgIGRvd25sb2FkOiAn15TXldeo15PXlCcsXG4gICAgZG93bmxvYWRpbmc6ICfXnteV16jXmdeT4oCmJyxcbiAgICB0cnlpbmc6ICfXnteg16HXlOKApicsXG4gICAgZG93bmxvYWRlZDogJ9eU15XXqdec150nLFxuICAgIGVycm9yOiAn16nXkteZ15DXlCcsXG4gICAgZmFpbGVkOiAn16DXm9ep15wnLFxuICAgIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLFxuICAgIHRpdGxlUXVpY2s6ICfXlNeV16jXk9eUINee15TXmdeo15QnLFxuICAgIGNvbW1lbnRzOiAn16rXkteV15HXldeqJyxcbiAgICBlZGl0ZWQ6ICfXoNei16jXmicsXG4gIH0sXG4gIGZhOiB7XG4gICAgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLFxuICAgIGRvd25sb2FkaW5nOiAn2K/Ysdit2KfZhCDYr9in2YbZhNmI2K/igKYnLFxuICAgIHRyeWluZzogJ9iq2YTYp9i0INmF2KzYr9iv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJyxcbiAgICBlcnJvcjogJ9iu2LfYpycsXG4gICAgZmFpbGVkOiAn2YbYp9mF2YjZgdmCJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLFxuICAgIHRpdGxlUXVpY2s6ICfYr9in2YbZhNmI2K8g2LPYsduM2LknLFxuICAgIGNvbW1lbnRzOiAn2YbYuNixJyxcbiAgICBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyxcbiAgfSxcbiAgZmlsOiB7XG4gICAgZG93bmxvYWQ6ICdJLWRvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ05hZ2RhLWRvd25sb2Fk4oCmJyxcbiAgICB0cnlpbmc6ICdTaW51c3VidWthbuKApicsXG4gICAgZG93bmxvYWRlZDogJ1RhcG9zIG5hJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdOYWJpZ28uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnTWFiaWxpcyBuYSBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdtZ2Ega29tZW50bycsXG4gICAgZWRpdGVkOiAnTmEtZWRpdCcsXG4gIH0sXG4gIG1zOiB7XG4gICAgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJyxcbiAgICBkb3dubG9hZGluZzogJ01lbXVhdCB0dXJ1buKApicsXG4gICAgdHJ5aW5nOiAnTWVuY3ViYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1NlbGVzYWknLFxuICAgIGVycm9yOiAnUmFsYXQnLFxuICAgIGZhaWxlZDogJ0dhZ2FsLicsXG4gICAgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsXG4gICAgdGl0bGVRdWljazogJ011YXQgdHVydW4gcGFudGFzJyxcbiAgICBjb21tZW50czogJ2tvbWVuJyxcbiAgICBlZGl0ZWQ6ICdEaWVkaXQnLFxuICB9LFxuICBzcjoge1xuICAgIGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0J/RgNC10YPQt9C40LzQsNGa0LXigKYnLFxuICAgIHRyeWluZzogJ9Cf0L7QutGD0YjQsNCy0LDQvOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdGD0LfQuNC80LDRmtC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicsXG4gIH0sXG4gIHNrOiB7XG4gICAgZG93bmxvYWQ6ICdTdGlhaG51xaUnLFxuICAgIGRvd25sb2FkaW5nOiAnU8WlYWhvdmFuaWXigKYnLFxuICAgIHRyeWluZzogJ1Nrw7rFoWFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSG90b3ZvJyxcbiAgICBlcnJvcjogJ0NoeWJhJyxcbiAgICBmYWlsZWQ6ICdabHloYWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJyxcbiAgICB0aXRsZVF1aWNrOiAnUsO9Y2hsZSBzdGlhaG51dGllJyxcbiAgICBjb21tZW50czogJ2tvbWVudMOhcm92JyxcbiAgICBlZGl0ZWQ6ICdVcHJhdmVuw6knLFxuICB9LFxuICBiZzoge1xuICAgIGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0JjQt9GC0LXQs9C70Y/QvdC14oCmJyxcbiAgICB0cnlpbmc6ICfQntC/0LjRguKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRitGA0LfQviDQuNC30YLQtdCz0LvRj9C90LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJyxcbiAgICBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyxcbiAgfSxcbiAgaHI6IHtcbiAgICBkb3dubG9hZDogJ1ByZXV6bWknLFxuICAgIGRvd25sb2FkaW5nOiAnUHJldXppbWFuamXigKYnLFxuICAgIHRyeWluZzogJ1Bva3XFoWF2YW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLFxuICAgIGVycm9yOiAnR3JlxaFrYScsXG4gICAgZmFpbGVkOiAnTmV1c3BqZWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnUHJldXptaScsXG4gICAgdGl0bGVRdWljazogJ0Jyem8gcHJldXppbWFuamUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJhJyxcbiAgICBlZGl0ZWQ6ICdVcmXEkWVubycsXG4gIH0sXG4gIGx0OiB7XG4gICAgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsXG4gICAgZG93bmxvYWRpbmc6ICdTaXVuxI1pYW1h4oCmJyxcbiAgICB0cnlpbmc6ICdCYW5kb21h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQmFpZ3RhJyxcbiAgICBlcnJvcjogJ0tsYWlkYScsXG4gICAgZmFpbGVkOiAnTmVwYXZ5a28uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsXG4gICAgdGl0bGVRdWljazogJ0dyZWl0YXMgYXRzaXNpdW50aW1hcycsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmFpJyxcbiAgICBlZGl0ZWQ6ICdSZWRhZ3VvdGEnLFxuICB9LFxuICBsdjoge1xuICAgIGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLFxuICAgIGRvd25sb2FkaW5nOiAnTGVqdXBpZWzEgWTEk+KApicsXG4gICAgdHJ5aW5nOiAnTcSTxKNpbmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsXG4gICAgZXJyb3I6ICdLxLzFq2RhJyxcbiAgICBmYWlsZWQ6ICdOZWl6ZGV2xIFzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLFxuICAgIHRpdGxlUXVpY2s6ICfEgHRyxIEgbGVqdXBpZWzEgWRlJyxcbiAgICBjb21tZW50czogJ2tvbWVudMSBcmknLFxuICAgIGVkaXRlZDogJ1JlZGnEo8STdHMnLFxuICB9LFxuICBldDoge1xuICAgIGRvd25sb2FkOiAnTGFhZGkgYWxsYScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWFkaW1pbmXigKYnLFxuICAgIHRyeWluZzogJ1Byb292aW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdWYWxtaXMnLFxuICAgIGVycm9yOiAnVmlnYScsXG4gICAgZmFpbGVkOiAnRWJhw7VubmVzdHVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsXG4gICAgdGl0bGVRdWljazogJ0tpaXJlIGFsbGFsYWFkaW1pbmUnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFhcmknLFxuICAgIGVkaXRlZDogJ011dWRldHVkJyxcbiAgfSxcbiAgc2w6IHtcbiAgICBkb3dubG9hZDogJ1ByZW5vcycsXG4gICAgZG93bmxvYWRpbmc6ICdQcmVuYcWhYW5qZeKApicsXG4gICAgdHJ5aW5nOiAnUG9za3XFoWFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS29uxI1hbm8nLFxuICAgIGVycm9yOiAnTmFwYWthJyxcbiAgICBmYWlsZWQ6ICdOaSB1c3BlbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLFxuICAgIHRpdGxlUXVpY2s6ICdIaXRlciBwcmVub3MnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJqZXYnLFxuICAgIGVkaXRlZDogJ1VyZWplbm8nLFxuICB9LFxuICBjYToge1xuICAgIGRvd25sb2FkOiAnRGVzY2FycmVnYScsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJyZWdhbnTigKYnLFxuICAgIHRyeWluZzogJ0ludGVudGFudOKApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdIYSBmYWxsYXQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY8OgcnJlZ2EgcsOgcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlzJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YXQnLFxuICB9LFxuICBhZjoge1xuICAgIGRvd25sb2FkOiAnQWZsYWFpJyxcbiAgICBkb3dubG9hZGluZzogJ0xhYWkgYWbigKYnLFxuICAgIHRyeWluZzogJ1Byb2JlZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFhcicsXG4gICAgZXJyb3I6ICdGb3V0JyxcbiAgICBmYWlsZWQ6ICdNaXNsdWsuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLFxuICAgIHRpdGxlUXVpY2s6ICdWaW5uaWdlIGFmbGFhaScsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlJyxcbiAgICBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyxcbiAgfSxcbiAgYW06IHtcbiAgICBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsXG4gICAgZG93bmxvYWRpbmc6ICfhiaDhiJvhi43hiKjhi7Ug4YiL4Yut4oCmJyxcbiAgICB0cnlpbmc6ICfhiaDhiJjhiJ7hiqjhiK0g4YiL4Yut4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJyxcbiAgICBlcnJvcjogJ+GIteGIheGJsOGJtScsXG4gICAgZmFpbGVkOiAn4Yqg4YiN4Ymw4Yiz4Yqr4Yid4Y2iJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLFxuICAgIHRpdGxlUXVpY2s6ICfhjYjhjKPhipUg4Yib4YuN4Yio4Yu1JyxcbiAgICBjb21tZW50czogJ+GKoOGIteGJsOGLq+GLqOGJtuGJvScsXG4gICAgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyxcbiAgfSxcbiAgaHk6IHtcbiAgICBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsXG4gICAgZG93bmxvYWRpbmc6ICfVhtWl1oDVotWl1bzVttW41oLVtOKApicsXG4gICAgdHJ5aW5nOiAn1ZPVuNaA1bHVuNaC1bQg1afigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJyxcbiAgICBlcnJvcjogJ9WN1a3VodWsJyxcbiAgICBmYWlsZWQ6ICfVgdWh1a3VuNWy1b7VpdaBOicsXG4gICAgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJyxcbiAgICB0aXRsZVF1aWNrOiAn1LHWgNWh1aMg1bbVpdaA1aLVpdW81bbVuNaC1bQnLFxuICAgIGNvbW1lbnRzOiAn1bTVpdWv1bbVodWi1aHVttW41oLVqdW11bjWgtW2JyxcbiAgICBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnLFxuICB9LFxuICBhczoge1xuICAgIGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoSDgprngp4gg4KaG4Kab4KeH4oCmJyxcbiAgICB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kew4Ka/IOCmhuCmm+Cnh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsXG4gICAgZXJyb3I6ICfgpqTgp43gp7Dgp4Hgpp/gpr8nLFxuICAgIGZhaWxlZDogJ+CmrOCmv+Cmq+CmsiDgprnigJngprInLFxuICAgIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgdGl0bGVRdWljazogJ+CmpuCnjeCnsOCngeCmpCDgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIGNvbW1lbnRzOiAn4Kau4Kao4KeN4Kak4Kas4KeN4KavJyxcbiAgICBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnLFxuICB9LFxuICBhejoge1xuICAgIGRvd25sb2FkOiAnWcO8a2zJmScsXG4gICAgZG93bmxvYWRpbmc6ICdZw7xrbMmZbmly4oCmJyxcbiAgICB0cnlpbmc6ICdDyZloZCBlZGlsaXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCaXRkaScsXG4gICAgZXJyb3I6ICdYyZl0YScsXG4gICAgZmFpbGVkOiAnQWzEsW5tYWTEsS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLFxuICAgIHRpdGxlUXVpY2s6ICdTw7xyyZl0bGkgecO8a2zJmW3JmScsXG4gICAgY29tbWVudHM6ICfFn8mZcmgnLFxuICAgIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyxcbiAgfSxcbiAgZXU6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLFxuICAgIGRvd25sb2FkaW5nOiAnRGVza2FyZ2F0emVu4oCmJyxcbiAgICB0cnlpbmc6ICdTYWlhdHplbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0VnaW5kYScsXG4gICAgZXJyb3I6ICdFcnJvcmVhJyxcbiAgICBmYWlsZWQ6ICdIdXRzIGVnaW4gZHUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JyxcbiAgICB0aXRsZVF1aWNrOiAnRGVza2FyZ2EgYXprYXJyYScsXG4gICAgY29tbWVudHM6ICdpcnV6a2luJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YXR1YScsXG4gIH0sXG4gIG15OiB7XG4gICAgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIGRvd25sb2FkaW5nOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6IOGAnOGAr+GAleGAuuGAlOGAseKApicsXG4gICAgdHJ5aW5nOiAn4YCA4YC84YCt4YCv4YC44YCF4YCs4YC44YCU4YCx4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJyxcbiAgICBlcnJvcjogJ+GAoeGAmeGAvuGArOGAuCcsXG4gICAgZmFpbGVkOiAn4YCZ4YCh4YCx4YCs4YCE4YC64YCZ4YC84YCE4YC64YCV4YCr4YGLJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIHRpdGxlUXVpY2s6ICfhgKHhgJnhgLzhgJThgLog4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICBjb21tZW50czogJ+GAmeGAvuGAkOGAuuGAgeGAu+GAgOGAuuGAmeGAu+GArOGAuCcsXG4gICAgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyxcbiAgfSxcbiAgZ2w6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsXG4gICAgdHJ5aW5nOiAnVGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGxvdS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICBrYToge1xuICAgIGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICBkb3dubG9hZGluZzogJ+GDmOGDrOGDlOGDoOGDlOGDkeGDkOKApicsXG4gICAgdHJ5aW5nOiAn4YOb4YOq4YOT4YOU4YOa4YOd4YOR4YOQ4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJyxcbiAgICBlcnJvcjogJ+GDqOGDlOGDquGDk+GDneGDm+GDkCcsXG4gICAgZmFpbGVkOiAn4YOV4YOU4YOgIOGDm+GDneGDruGDlOGDoOGDruGDk+GDkC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgdGl0bGVRdWljazogJ+GDoeGDrOGDoOGDkOGDpOGDmCDhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIGNvbW1lbnRzOiAn4YOZ4YOd4YOb4YOU4YOc4YOi4YOQ4YOg4YOYJyxcbiAgICBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnLFxuICB9LFxuICBpczoge1xuICAgIGRvd25sb2FkOiAnU8Oma2phJyxcbiAgICBkb3dubG9hZGluZzogJ1PDpmtpcuKApicsXG4gICAgdHJ5aW5nOiAnUmV5bmnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTw7N0dCcsXG4gICAgZXJyb3I6ICdWaWxsYScsXG4gICAgZmFpbGVkOiAnTWlzdMOza3N0LicsXG4gICAgYXJpYURvd25sb2FkOiAnU8Oma2phJyxcbiAgICB0aXRsZVF1aWNrOiAnRmzDvXRpbmnDsHVyaGFsJyxcbiAgICBjb21tZW50czogJ3VtbcOmbGknLFxuICAgIGVkaXRlZDogJ0JyZXl0dCcsXG4gIH0sXG4gIGdhOiB7XG4gICAgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLFxuICAgIGRvd25sb2FkaW5nOiAnQWcgw61vc2zDs2TDoWls4oCmJyxcbiAgICB0cnlpbmc6ICdBZyBpYXJyYWlkaOKApicsXG4gICAgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJyxcbiAgICBlcnJvcjogJ0VhcnLDoWlkJyxcbiAgICBmYWlsZWQ6ICdUaGVpcCBhaXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLFxuICAgIHRpdGxlUXVpY2s6ICfDjW9zbMOzZMOhaWwgdGFwYScsXG4gICAgY29tbWVudHM6ICd0csOhY2h0JyxcbiAgICBlZGl0ZWQ6ICdFYWdyYWl0aGUnLFxuICB9LFxuICBrazoge1xuICAgIGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsXG4gICAgZG93bmxvYWRpbmc6ICfQltKv0LrRgtC10LvRg9C00LXigKYnLFxuICAgIHRyeWluZzogJ9OY0YDQtdC60LXRguKApicsXG4gICAgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLFxuICAgIGVycm9yOiAn0prQsNGC0LUnLFxuICAgIGZhaWxlZDogJ9Ch05nRgtGB0ZbQty4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLFxuICAgIHRpdGxlUXVpY2s6ICfQltGL0LvQtNCw0Lwg0LbSr9C60YLQtdGDJyxcbiAgICBjb21tZW50czogJ9C/0ZbQutGW0YAnLFxuICAgIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyxcbiAgfSxcbiAga206IHtcbiAgICBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsXG4gICAgZG93bmxvYWRpbmc6ICfhnoDhn4bhnpbhnrvhnoThnpHhnrbhnonhnpnhnoDigKYnLFxuICAgIHRyeWluZzogJ+GegOGfhuGeluGeu+GehOGeluGfkuGemeGetuGemeGetuGemOKApicsXG4gICAgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsXG4gICAgZXJyb3I6ICfhnoDhn4bhnqDhnrvhnp8nLFxuICAgIGZhaWxlZDogJ+GelOGemuGetuGeh+GfkOGemScsXG4gICAgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJyxcbiAgICB0aXRsZVF1aWNrOiAn4Z6R4Z624Z6J4Z6Z4Z6A4Z6b4Z6/4Z6TJyxcbiAgICBjb21tZW50czogJ+GemOGej+GetycsXG4gICAgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyxcbiAgfSxcbiAgbG86IHtcbiAgICBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsXG4gICAgZG93bmxvYWRpbmc6ICfguoHgurPguqXgurHguofgupTgurLguqfgu4LguqvguqXgupTigKYnLFxuICAgIHRyeWluZzogJ+C6geC6s+C6peC6seC6h+C6nuC6sOC6jeC6suC6jeC6suC6oeKApicsXG4gICAgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsXG4gICAgZXJyb3I6ICfgupzgurTgupTgup7gurLgupQnLFxuICAgIGZhaWxlZDogJ+C6peC6u+C7ieC6oeC7gOC6q+C6peC6pycsXG4gICAgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJyxcbiAgICB0aXRsZVF1aWNrOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4LqU4LuI4Lqn4LqZJyxcbiAgICBjb21tZW50czogJ+C6hOC6s+C7gOC6q+C6seC6mScsXG4gICAgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyxcbiAgfSxcbiAgbWs6IHtcbiAgICBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JyxcbiAgICBkb3dubG9hZGluZzogJ9Cf0YDQtdC30LXQvNCw0ZrQteKApicsXG4gICAgdHJ5aW5nOiAn0KHQtSDQvtCx0LjQtNGD0LLQsNC84oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXQt9C10LzQsNGa0LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNC4JyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyxcbiAgfSxcbiAgbW46IHtcbiAgICBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLFxuICAgIGRvd25sb2FkaW5nOiAn0KLQsNGC0LDQtiDQsdCw0LnQvdCw4oCmJyxcbiAgICB0cnlpbmc6ICfQntGA0LvQtNC+0LYg0LHQsNC50L3QsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsXG4gICAgZXJyb3I6ICfQkNC70LTQsNCwJyxcbiAgICBmYWlsZWQ6ICfQkNC80LbQuNC70YLQs9Kv0LkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJyxcbiAgICB0aXRsZVF1aWNrOiAn0KXRg9GA0LTQsNC9INGC0LDRgtCw0YUnLFxuICAgIGNvbW1lbnRzOiAn0YHRjdGC0LPRjdCz0LTRjdC7JyxcbiAgICBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nLFxuICB9LFxuICBuZToge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYHgpIHgpKbgpYjigKYnLFxuICAgIHRyeWluZzogJ+CkquCljeCksOCkr+CkvuCkuCDgpJfgpLDgpY3gpKbgpYjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+CkvycsXG4gICAgZmFpbGVkOiAn4KSF4KS44KSr4KSyIOCkreCkr+CliycsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSb4KS/4KSf4KWLIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpYDgpLngpLDgpYInLFxuICAgIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIG9yOiB7XG4gICAgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NIOCsueCth+CsieCsm+Csv+KApicsXG4gICAgdHJ5aW5nOiAn4Kya4K2H4Ky34K2N4Kyf4Ky+IOCsleCssOCtgeCsm+Csv+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsXG4gICAgZXJyb3I6ICfgrKTgrY3grLDgrYHgrJ/grL8nLFxuICAgIGZhaWxlZDogJ+CsrOCsv+Csq+CssyDgrLngrYfgrLLgrL4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgdGl0bGVRdWljazogJ+CstuCtgOCsmOCtjeCssCDgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIGNvbW1lbnRzOiAn4Kyu4Kyo4K2N4Kyk4Kys4K2N4K2fJyxcbiAgICBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnLFxuICB9LFxuICBzaToge1xuICAgIGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJyxcbiAgICBkb3dubG9hZGluZzogJ+C2tuC3j+C2nOC2rSDgt4Dgt5ngtrjgt5LgtrHgt4rigKYnLFxuICAgIHRyeWluZzogJ+C2i+C2reC3iuC3g+C3j+C3hCDgtprgtrvgtrjgt5LgtrHgt4rigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLFxuICAgIGVycm9yOiAn4Lav4Led4LeC4La64Laa4LeSJyxcbiAgICBmYWlsZWQ6ICfgtoXgt4Pgt4/gtrvgt4rgtq7gtprgtrrgt5InLFxuICAgIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsXG4gICAgdGl0bGVRdWljazogJ+C2ieC2muC3iuC2uOC2seC3iiDgtrbgt4/gtpzgtq0g4Laa4LeS4La74LeT4La4JyxcbiAgICBjb21tZW50czogJ+C2heC2r+C3hOC3g+C3iicsXG4gICAgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyxcbiAgfSxcbiAgc3c6IHtcbiAgICBkb3dubG9hZDogJ1Bha3VhJyxcbiAgICBkb3dubG9hZGluZzogJ0luYXBha3Vh4oCmJyxcbiAgICB0cnlpbmc6ICdJbmFqYXJpYnXigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsXG4gICAgZXJyb3I6ICdIaXRpbGFmdScsXG4gICAgZmFpbGVkOiAnSW1lc2hpbmR3YS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1Bha3VhJyxcbiAgICB0aXRsZVF1aWNrOiAnUGFrdWEgaGFyYWthJyxcbiAgICBjb21tZW50czogJ21hb25pJyxcbiAgICBlZGl0ZWQ6ICdJbWVoYXJpcml3YScsXG4gIH0sXG4gIHV6OiB7XG4gICAgZG93bmxvYWQ6ICdZdWtsYXNoJyxcbiAgICBkb3dubG9hZGluZzogJ1l1a2xhbm1vcWRh4oCmJyxcbiAgICB0cnlpbmc6ICdVcmluaWxtb3FkYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1RheXlvcicsXG4gICAgZXJyb3I6ICdYYXRvJyxcbiAgICBmYWlsZWQ6ICdNdXZhZmZhcWl5YXRzaXouJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJyxcbiAgICB0aXRsZVF1aWNrOiAnVGV6IHl1a2xhc2gnLFxuICAgIGNvbW1lbnRzOiAnc2hhcmhsYXInLFxuICAgIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicsXG4gIH0sXG4gIGN5OiB7XG4gICAgZG93bmxvYWQ6ICdMYXdybHd5dGhvJyxcbiAgICBkb3dubG9hZGluZzogJ1luIGxhd3Jsd3l0aG/igKYnLFxuICAgIHRyeWluZzogJ1luIGNlaXNpb+KApicsXG4gICAgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsXG4gICAgZXJyb3I6ICdHd2FsbCcsXG4gICAgZmFpbGVkOiAnTWV0aG9kZC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLFxuICAgIHRpdGxlUXVpY2s6ICdMYXdybHd5dGhvIGN5Zmx5bScsXG4gICAgY29tbWVudHM6ICdzeWx3YWRhdScsXG4gICAgZWRpdGVkOiAnR29seWd3eWQnLFxuICB9LFxuICB6dToge1xuICAgIGRvd25sb2FkOiAnTGFuZGEnLFxuICAgIGRvd25sb2FkaW5nOiAnSXlhbGFuZHdh4oCmJyxcbiAgICB0cnlpbmc6ICdJeWF6YW1h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJyxcbiAgICBlcnJvcjogJ0lwaHV0aGEnLFxuICAgIGZhaWxlZDogJ0lobHVsZWtpbGUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYW5kYScsXG4gICAgdGl0bGVRdWljazogJ1VrdWxhbmRhIG9rdXNoZXNoYXlvJyxcbiAgICBjb21tZW50czogJ2FtYXp3YW5hJyxcbiAgICBlZGl0ZWQ6ICdLdWhsZWxpd2UnLFxuICB9LFxuICBzcToge1xuICAgIGRvd25sb2FkOiAnU2hrYXJrbycsXG4gICAgZG93bmxvYWRpbmc6ICdEdWtlIHNoa2Fya3VhcuKApicsXG4gICAgdHJ5aW5nOiAnRHVrZSBwcm92dWFy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsXG4gICAgZXJyb3I6ICdHYWJpbScsXG4gICAgZmFpbGVkOiAnRMOrc2h0b2kuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJyxcbiAgICB0aXRsZVF1aWNrOiAnU2hrYXJraW0gaSBzaHBlanTDqycsXG4gICAgY29tbWVudHM6ICdrb21lbnRlJyxcbiAgICBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicsXG4gIH0sXG59O1xuXG5leHBvcnQgdHlwZSBMYW5nS2V5ID0ga2V5b2YgdHlwZW9mIFRSQU5TTEFUSU9OUy5lbjtcblxuZXhwb3J0IGZ1bmN0aW9uIHQoa2V5OiBMYW5nS2V5KTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBpZiAoIWtleSB8fCB0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuICcuLi4nO1xuICAgIH1cblxuICAgIGxldCByYXdMYW5nID0gJ2VuJztcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiZcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nXG4gICAgKSB7XG4gICAgICByYXdMYW5nID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lmxhbmc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IubGFuZ3VhZ2UpIHtcbiAgICAgIHJhd0xhbmcgPSBuYXZpZ2F0b3IubGFuZ3VhZ2U7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZExhbmcgPSByYXdMYW5nXG4gICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgLnNwbGl0KCc7JylbMF1cbiAgICAgIC50cmltKClcbiAgICAgIC5yZXBsYWNlKCdfJywgJy0nKTtcbiAgICBjb25zdCBiYXNlTGFuZyA9IG5vcm1hbGl6ZWRMYW5nLnNwbGl0KCctJylbMF07XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbJ2VuJ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5O1xuICB9IGNhdGNoIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldIHx8IGtleTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBTdHJpbmcoa2V5IHx8ICdEb3dubG9hZCcpO1xuICAgIH1cbiAgfVxufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHNcblxuLyoqXG4gKiBUSEVNRSBERVRFQ1RPUlxuICpcbiAqIEdvYWw6IFwiSXMgdGhlIGNvbnRlbnQgSSdtIGRyYXdpbmcgb24gdmlzdWFsbHkgZGFyayBvciBsaWdodD9cIlxuICogSW5zdGVhZCBvZiBndWVzc2luZyBmcm9tIDxib2R5Piwgd2U6XG4gKiAgLSBSZXNwZWN0IERhcmsgUmVhZGVyIGlmIHByZXNlbnRcbiAqICAtIExvb2sgZm9yIG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzXG4gKiAgLSBNZWFzdXJlIHRoZSBlZmZlY3RpdmUgYmFja2dyb3VuZCBjb2xvciBvZiBhICpjb250ZW50KiBlbGVtZW50XG4gKiAgICAoZS5nLiBHb29nbGUgQ2xhc3Nyb29tIHN0cmVhbSBjYXJkcylcbiAqL1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFnZSAqY29udGVudCBhcmVhKiBpcyB2aXN1YWxseSBkYXJrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQYWdlRGFyaygpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAxLiBGYXN0IHBhdGg6IERhcmsgUmVhZGVyIGF0dHJpYnV0ZVxuICBjb25zdCBkclNjaGVtZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnKTtcbiAgaWYgKGRyU2NoZW1lID09PSAnZGFyaycpIHJldHVybiB0cnVlO1xuICBpZiAoZHJTY2hlbWUgPT09ICdsaWdodCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAyLiBIZXVyaXN0aWM6IG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzIG9uIDxodG1sPiAvIDxib2R5PlxuICAvLyAoY292ZXJzIHNvbWUgZnJhbWV3b3JrcyBhbmQgZXh0ZW5zaW9ucylcbiAgY29uc3QgZGFya1Rva2VucyA9IFsnZGFyaycsICdkYXJrLXRoZW1lJywgJ3RoZW1lLWRhcmsnLCAnbmlnaHQnLCAnZ20zLWRhcmstdGhlbWUnXTtcbiAgY29uc3QgaHRtbENsYXNzID0gKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHlDbGFzcyA9IChkb2N1bWVudC5ib2R5LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGRhcmtUb2tlbnMuc29tZSh0b2tlbiA9PiBodG1sQ2xhc3MuaW5jbHVkZXModG9rZW4pIHx8IGJvZHlDbGFzcy5pbmNsdWRlcyh0b2tlbikpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyAzLiBQcm9iZSBhICpjb250ZW50KiBlbGVtZW50LCBub3QgdGhlIHdob2xlIHBhZ2UgYmFja2dyb3VuZC5cbiAgLy8gICAgRm9yIENsYXNzcm9vbSwgcG9zdHMgYXJlIHRoZSBtYWluIHN1cmZhY2Ugd2UgZHJhdyBvbi5cbiAgY29uc3QgcHJvYmVFbCA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXScpIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tyb2xlPVwibWFpblwiXScpIHx8XG4gICAgZG9jdW1lbnQuYm9keTtcblxuICBjb25zdCBiZ0NvbG9yID0gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHByb2JlRWwpO1xuICBjb25zdCBicmlnaHRuZXNzID0gcGFyc2VCcmlnaHRuZXNzKGJnQ29sb3IpO1xuXG4gIC8vIDQuIERlY2lkZSB0aHJlc2hvbGQuXG4gIC8vICAgIDEyOCBpcyBcIjUwJSBncmF5XCIsIGJ1dCB0aGF0IGZsaXBzIHRvbyBlYXJseSBvbiBzbGlnaHRseSBncmF5IFVJcy5cbiAgLy8gICAgVXNlIGEgc3RyaWN0ZXIgdGhyZXNob2xkIHNvIHdlIG9ubHkgdHJlYXQgY2xlYXJseSBkYXJrIFVJcyBhcyBkYXJrLlxuICByZXR1cm4gYnJpZ2h0bmVzcyA8IDEwNTtcbn1cblxuLyoqXG4gKiBXYWxrcyB1cCB0aGUgRE9NIGZyb20gYSBnaXZlbiBlbGVtZW50IHVudGlsIGl0IGZpbmRzIGEgbm9uLXRyYW5zcGFyZW50IGJhY2tncm91bmQgY29sb3IuXG4gKiBGYWxscyBiYWNrIHRvIDxodG1sPiBhbmQgZmluYWxseSB0byBwdXJlIHdoaXRlLlxuICovXG5mdW5jdGlvbiBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3Ioc3RhcnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBzdGFydDtcblxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gKGM6IHN0cmluZyB8IG51bGwpID0+XG4gICAgIWMgfHwgYyA9PT0gJ3RyYW5zcGFyZW50JyB8fCBjID09PSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgY29uc3QgYmcgPSBzdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgaWYgKCFpc1RyYW5zcGFyZW50KGJnKSkgcmV0dXJuIGJnO1xuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIC8vIFRyeSA8aHRtbD4gYXMgYSBsYXN0IHJlYWwgZWxlbWVudFxuICBjb25zdCBodG1sU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICBjb25zdCBodG1sQmcgPSBodG1sU3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICBpZiAoIWlzVHJhbnNwYXJlbnQoaHRtbEJnKSkgcmV0dXJuIGh0bWxCZztcblxuICAvLyBBYnNvbHV0ZSBmYWxsYmFjazogYXNzdW1lIHdoaXRlXG4gIHJldHVybiAncmdiKDI1NSwgMjU1LCAyNTUpJztcbn1cblxuLyoqXG4gKiBIZWxwZXI6IENhbGN1bGF0ZXMgYnJpZ2h0bmVzcyAoMC0yNTUpIGZyb20gYW4gUkdCKEEpIHN0cmluZy5cbiAqIFVzZXMgdGhlIEhTUCBjb2xvciBmb3JtdWxhOiBzcXJ0KDAuMjk5KlJeMiArIDAuNTg3KkdeMiArIDAuMTE0KkJeMilcbiAqL1xuZnVuY3Rpb24gcGFyc2VCcmlnaHRuZXNzKHJnYlN0cmluZzogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSByZ2JTdHJpbmcubWF0Y2goLyhcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKykvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIElmIHdlIGNhbid0IHBhcnNlIGl0LCBhc3N1bWUgYnJpZ2h0IHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBmbGlwIHRvIGRhcmsgbW9kZS5cbiAgICByZXR1cm4gMjU1O1xuICB9XG5cbiAgY29uc3QgciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIGNvbnN0IGcgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuICBjb25zdCBiID0gcGFyc2VJbnQobWF0Y2hbM10sIDEwKTtcblxuICAvLyBIU1AgZXF1YXRpb24gaXMgcGVyY2VpdmVkIGJyaWdodG5lc3NcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IE1hdGguc3FydChcbiAgICAwLjI5OSAqIChyICogcikgK1xuICAgIDAuNTg3ICogKGcgKiBnKSArXG4gICAgMC4xMTQgKiAoYiAqIGIpXG4gICk7XG5cbiAgcmV0dXJuIGJyaWdodG5lc3M7XG59XG5cbi8qKlxuICogV2F0Y2hlcjogTm90aWZpZXMgeW91IHdoZW4gdGhlIHRoZW1lIGxpa2VseSBjaGFuZ2VkLlxuICpcbiAqIFlvdSBjYW4gdXNlIHRoaXMgaWYgeW91IGV2ZXIgd2FudCB0byBkeW5hbWljYWxseSByZS1zdHlsZSB0aGluZ3NcbiAqIHdoZW4gdGhlIHVzZXIgLyBleHRlbnNpb24gdG9nZ2xlcyB0aGVtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoVGhlbWVDaGFuZ2VzKGNhbGxiYWNrOiAoaXNEYXJrOiBib29sZWFuKSA9PiB2b2lkKTogTXV0YXRpb25PYnNlcnZlciB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoKSA9PiB7XG4gICAgY2FsbGJhY2soaXNQYWdlRGFyaygpKTtcbiAgfTtcblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuXG4gIC8vIFdhdGNoIGZvciBhdHRyaWJ1dGUvY2xhc3MgY2hhbmdlcyBvbiA8aHRtbD4gYW5kIDxib2R5PlxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnLCAnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgLy8gQWxzbyBsaXN0ZW4gdG8gc3lzdGVtIHRoZW1lIGNoYW5nZXMgYXMgYSBiYWNrdXAgc2lnbmFsXG4gIGlmICh0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWEgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zdCBtcSA9IHdpbmRvdy5tYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG4gICAgaWYgKG1xKSB7XG4gICAgICBjb25zdCBtcUxpc3RlbmVyID0gKCkgPT4gaGFuZGxlcigpO1xuICAgICAgLy8gTW9kZXJuIGJyb3dzZXJzXG4gICAgICBpZiAoKG1xIGFzIGFueSkuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBtcS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBtcUxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSBpZiAoKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIpIHtcbiAgICAgICAgLy8gTGVnYWN5IEFQSVxuICAgICAgICAobXEgYXMgYW55KS5hZGRMaXN0ZW5lcihtcUxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGNhbGwgc28gdGhlIGNvbnN1bWVyIGNhbiBzeW5jIGltbWVkaWF0ZWx5XG4gIGhhbmRsZXIoKTtcblxuICByZXR1cm4gb2JzZXJ2ZXI7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9pbmRleC50c1xuXG5jb25zdCBDTEFTU1JPT01fVVJMX1BBVFRFUk4gPSAvXmh0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcLy87XG5cbmltcG9ydCB7XG4gIERPV05MT0FEX0lDT05fU1ZHX1VSTCxcbiAgU1VDQ0VTU19JQ09OX1NWR19VUkwsXG4gIEVSUk9SX0lDT05fU1ZHX1VSTCxcbn0gZnJvbSAnLi9pY29ucyc7XG5cbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vc3R5bGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vdGhlbWUnO1xuXG5jb25zdCBJTkpFQ1RFRF9BVFRSID0gJ2RhdGEtY3FkLWluamVjdGVkJztcbmNvbnN0IFBST0NFU1NFRF9BVFRSID0gJ2RhdGEtY3FkLXByb2Nlc3NlZCc7XG5jb25zdCBSRVNDQU5fSU5URVJWQUxfTVMgPSAyMDAwOyAvLyBTcGVlZCB1cCBzbGlnaHRseVxuY29uc3QgUkVTQ0FOX0RFQk9VTkNFX01TID0gMjAwO1xuY29uc3QgTE9BRElOR19NSU5fTVMgPSA2MDA7XG5jb25zdCBGRUVEQkFDS19TVUNDRVNTX01TID0gMzAwMDtcbmNvbnN0IEZFRURCQUNLX0VSUk9SX01TID0gNDAwMDtcblxuY29uc3QgRFJJVkVfQU5DSE9SX1NFTEVDVE9SID1cbiAgJ2FbaHJlZio9XCJodHRwczovL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCIvL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCJjbGFzc3Jvb20uZ29vZ2xlLmNvbS9kcml2ZVwiXSc7XG5cbmNvbnN0IEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SID0gW1xuICAnLktsUlhkZicsXG4gICcuejN2UmNjJyxcbiAgJy5WZlBwa2QtYVBQNzhlJyxcbiAgJ1tkYXRhLWRyaXZlLWlkXScsXG4gICdbZGF0YS1pZF1bZGF0YS1pdGVtLWlkXScsXG5dLmpvaW4oJywgJyk7XG5cbmNvbnN0IERSSVZFX1VSTF9QQVRURVJOUzogUmVnRXhwW10gPSBbXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL2ZpbGVcXC9kXFwvLyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvb3BlblxcPy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcL2RyaXZlXFwvLyxcbl07XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBHbG9iYWwgU3RhdGVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbnR5cGUgUXVlcnlSb290ID0gRG9jdW1lbnQgfCBIVE1MRWxlbWVudCB8IERvY3VtZW50RnJhZ21lbnQ7XG5cbmxldCBzY2FuVGltZW91dElkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbmxldCBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB8ICd0cnlpbmcnO1xuXG50eXBlIEZpbGVNZXRhID0ge1xuICBuYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIGtpbmQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIFBlbmRpbmdCdXR0b24gPSB7XG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlcXVlc3RJZDogc3RyaW5nO1xuICBmaWxlTWV0YT86IEZpbGVNZXRhO1xuICBzdGFydGVkQXQ6IG51bWJlcjtcbn07XG5cbmxldCBuZXh0UmVxdWVzdFNlcSA9IDE7XG5jb25zdCBwZW5kaW5nQnV0dG9ucyA9IG5ldyBNYXA8c3RyaW5nLCBQZW5kaW5nQnV0dG9uPigpO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRW52aXJvbm1lbnQgLyBQYWdlIENoZWNrc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaXNHb29nbGVDbGFzc3Jvb20oKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgbG9jYXRpb24gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGlmIChsb2NhdGlvbi5ob3N0bmFtZSAhPT0gJ2NsYXNzcm9vbS5nb29nbGUuY29tJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gQ0xBU1NST09NX1VSTF9QQVRURVJOLnRlc3QobG9jYXRpb24uaHJlZik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTY2FubmluZyAvIE9ic2VydmVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2NoZWR1bGVTY2FuKCk6IHZvaWQge1xuICBpZiAoc2NhblRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoc2NhblRpbWVvdXRJZCk7XG4gIH1cbiAgc2NhblRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICBzY2FuVGltZW91dElkID0gbnVsbDtcbiAgICBzY2FuRm9yQXR0YWNobWVudHMoZG9jdW1lbnQpO1xuICB9LCBSRVNDQU5fREVCT1VOQ0VfTVMpO1xufVxuXG5mdW5jdGlvbiBzZXR1cE9ic2VydmVycygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcblxuICBpZiAoIWRvY3VtZW50LmJvZHkpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICdET01Db250ZW50TG9hZGVkJyxcbiAgICAgICgpID0+IHNldHVwT2JzZXJ2ZXJzKCksXG4gICAgICB7IG9uY2U6IHRydWUgfSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAob2JzZXJ2ZXIpIHJldHVybjtcblxuICBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcbiAgICBjb25zdCByb290cyA9IG5ldyBTZXQ8UXVlcnlSb290PigpO1xuICAgIGxldCBzaG91bGRTY2FuID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IG0gb2YgbXV0YXRpb25zKSB7XG4gICAgICBpZiAobS50eXBlICE9PSAnY2hpbGRMaXN0JykgY29udGludWU7XG5cbiAgICAgIC8vIE9wdGltaXphdGlvbjogZmlsdGVyIG91dCBvdXIgb3duIG11dGF0aW9uc1xuICAgICAgY29uc3QgaXNJbnRlcm5hbCA9IEFycmF5LmZyb20obS5hZGRlZE5vZGVzKS5zb21lKG4gPT5cbiAgICAgICAgbi5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUgJiZcbiAgICAgICAgKG4gYXMgRWxlbWVudCkuaGFzQXR0cmlidXRlKElOSkVDVEVEX0FUVFIpXG4gICAgICApO1xuICAgICAgaWYgKGlzSW50ZXJuYWwpIGNvbnRpbnVlO1xuXG4gICAgICBzaG91bGRTY2FuID0gdHJ1ZTtcbiAgICAgIG0uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgIHJvb3RzLmFkZChub2RlIGFzIEhUTUxFbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHNob3VsZFNjYW4pIHtcbiAgICAgIGlmIChyb290cy5zaXplID09PSAwKSB7XG4gICAgICAgIHNjaGVkdWxlU2NhbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcm9vdHMuZm9yRWFjaCgocm9vdCkgPT4gc2NhbkZvckF0dGFjaG1lbnRzKHJvb3QpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICB9KTtcblxuICB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIHNjaGVkdWxlU2NhbigpO1xuICB9LCBSRVNDQU5fSU5URVJWQUxfTVMpO1xuXG4gIHNjaGVkdWxlU2NhbigpO1xufVxuXG5mdW5jdGlvbiBzY2FuRm9yQXR0YWNobWVudHMocm9vdDogUXVlcnlSb290ID0gZG9jdW1lbnQpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKHJvb3QpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogU2luZ2xlLWZpbGUgYnV0dG9uc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaW5qZWN0U2luZ2xlRmlsZUJ1dHRvbnMocm9vdDogUXVlcnlSb290ID0gZG9jdW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgYW5jaG9ycyA9IEFycmF5LmZyb20oXG4gICAgcm9vdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpLFxuICApO1xuXG4gIGZvciAoY29uc3QgYW5jaG9yIG9mIGFuY2hvcnMpIHtcbiAgICBjb25zdCB1cmwgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcik7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgY29udGFpbmVyID1cbiAgICAgIChhbmNob3IuY2xvc2VzdChBVFRBQ0hNRU5UX0NPTlRBSU5FUl9TRUxFQ1RPUikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSB8fFxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQgfHxcbiAgICAgIGFuY2hvcjtcblxuICAgIGlmICghY29udGFpbmVyKSBjb250aW51ZTtcblxuICAgIC8vIEZJWDogXCJOb3JtYWwgYnV0dG9ucyBkb2Vzbid0IGFwcGVhclwiXG4gICAgLy8gV2Ugc3RyaWN0bHkgY2hlY2sgaWYgdGhlIGJ1dHRvbiAqZXhpc3RzKiBpbnNpZGUuXG4gICAgLy8gSWYgUmVhY3QgcmUtcmVuZGVyZWQgdGhlIGNvbnRhaW5lciBjb250ZW50LCB0aGUgYnV0dG9uIGlzIGdvbmUsIHNvIHdlIG11c3QgcmUtaW5qZWN0LlxuICAgIGlmIChoYXNJbmplY3RlZEJ1dHRvbihjb250YWluZXIpKSBjb250aW51ZTtcblxuICAgIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGNvbnRhaW5lciwgdXJsKTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBkYXRhLWRyaXZlLWlkIGVsZW1lbnRzIChwcmV2aWV3cylcbiAgY29uc3QgbWV0YUVsZW1lbnRzID0gQXJyYXkuZnJvbShcbiAgICByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgICAgJ1tkYXRhLWRyaXZlLWlkXSwgW2RhdGEtaWRdW2RhdGEtaXRlbS1pZF0sIFtkYXRhLWlkXVtkYXRhLXRvb2x0aXBdJyxcbiAgICApLFxuICApO1xuXG4gIGZvciAoY29uc3QgZWwgb2YgbWV0YUVsZW1lbnRzKSB7XG4gICAgaWYgKGhhc0luamVjdGVkQnV0dG9uKGVsKSkgY29udGludWU7XG5cbiAgICBjb25zdCB1cmwgPSBmaW5kRHJpdmVVcmwoZWwpO1xuICAgIGlmICghdXJsKSBjb250aW51ZTtcblxuICAgIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGVsLCB1cmwpO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBVUkwgLyBET00gSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICAvLyBXZSBjaGVjayBpZiB0aGUgYnV0dG9uIGlzIGFjdHVhbGx5IGluIHRoZSBET01cbiAgcmV0dXJuICEhY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoYFske0lOSkVDVEVEX0FUVFJ9PVwidHJ1ZVwiXWApO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcjogSFRNTEFuY2hvckVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgaHJlZiA9IGFuY2hvci5ocmVmO1xuICBpZiAoIWhyZWYpIHJldHVybiBudWxsO1xuICByZXR1cm4gRFJJVkVfVVJMX1BBVFRFUk5TLnNvbWUoKHJlKSA9PiByZS50ZXN0KGhyZWYpKSA/IGhyZWYgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRHJpdmVVcmwoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbmVhckFuY2hvciA9XG4gICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpIHx8XG4gICAgKGVsZW1lbnQuY2xvc2VzdChEUklWRV9BTkNIT1JfU0VMRUNUT1IpIGFzIEhUTUxBbmNob3JFbGVtZW50IHwgbnVsbCk7XG5cbiAgaWYgKG5lYXJBbmNob3IpIHtcbiAgICBjb25zdCBocmVmID0gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihuZWFyQW5jaG9yKTtcbiAgICBpZiAoaHJlZikgcmV0dXJuIGhyZWY7XG4gIH1cblxuICBjb25zdCBkcml2ZUlkID1cbiAgICBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1kcml2ZS1pZCcpIHx8IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWlkJyk7XG4gIGlmIChkcml2ZUlkKSB7XG4gICAgcmV0dXJuIHRvRG93bmxvYWRVcmwoXG4gICAgICBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2VuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgZHJpdmVJZCxcbiAgICAgICl9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRBdXRoVXNlcigpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbiAgaWYgKHBhcmFtcy5oYXMoJ2F1dGh1c2VyJykpIHJldHVybiBwYXJhbXMuZ2V0KCdhdXRodXNlcicpO1xuICBpZiAocGFyYW1zLmhhcygndScpKSByZXR1cm4gcGFyYW1zLmdldCgndScpO1xuICBjb25zdCBwYXRoTWF0Y2ggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUubWF0Y2goL1xcL3VcXC8oXFxkKylcXC8vKTtcbiAgaWYgKHBhdGhNYXRjaCkgcmV0dXJuIHBhdGhNYXRjaFsxXTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHRvRG93bmxvYWRVcmwob3JpZ2luYWxVcmw6IHN0cmluZywgZGVwdGggPSAwKTogc3RyaW5nIHtcbiAgaWYgKGRlcHRoID4gMykgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICBjb25zdCBhdXRoVXNlciA9IGdldEF1dGhVc2VyKCk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKG9yaWdpbmFsVXJsLCBsb2NhdGlvbi5ocmVmKTtcbiAgICBjb25zdCBhcHBlbmRBdXRoID0gKHU6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKCFhdXRoVXNlcikgcmV0dXJuIHU7XG4gICAgICBjb25zdCBuZXdVID0gbmV3IFVSTCh1KTtcbiAgICAgIGlmICghbmV3VS5zZWFyY2hQYXJhbXMuaGFzKCdhdXRodXNlcicpKSB7XG4gICAgICAgIG5ld1Uuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBhdXRoVXNlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3VS50b1N0cmluZygpO1xuICAgIH07XG5cbiAgICBpZiAocGFyc2VkLmhvc3RuYW1lID09PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2F1dGhfd2FybXVwJykpIHtcbiAgICAgICAgY29uc3QgY29udCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdjb250aW51ZScpO1xuICAgICAgICBpZiAoY29udCkgcmV0dXJuIHRvRG93bmxvYWRVcmwoY29udCwgZGVwdGggKyAxKTtcbiAgICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKTtcbiAgICAgICAgaWYgKGlkKSByZXR1cm4gYXBwZW5kQXV0aChgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2lkfWApO1xuICAgICAgICByZXR1cm4gYXBwZW5kQXV0aChvcmlnaW5hbFVybCk7XG4gICAgICB9XG4gICAgICBjb25zdCBmaWxlTWF0Y2ggPSBwYXJzZWQucGF0aG5hbWUubWF0Y2goL15cXC9maWxlXFwvZFxcLyhbXi9dKykvKTtcbiAgICAgIGlmIChmaWxlTWF0Y2gpIHtcbiAgICAgICAgcmV0dXJuIGFwcGVuZEF1dGgoYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtmaWxlTWF0Y2hbMV19YCk7XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VkLnBhdGhuYW1lID09PSAnL29wZW4nIHx8IHBhcnNlZC5wYXRobmFtZSA9PT0gJy91YycpIHtcbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoJ2V4cG9ydCcsICdkb3dubG9hZCcpO1xuICAgICAgICBpZiAoYXV0aFVzZXIpIHBhcnNlZC5zZWFyY2hQYXJhbXMuc2V0KCdhdXRodXNlcicsIGF1dGhVc2VyKTtcbiAgICAgICAgcmV0dXJuIHBhcnNlZC50b1N0cmluZygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwYXJzZWQuaG9zdG5hbWUgPT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScgJiYgcGFyc2VkLnBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9kcml2ZScpKSB7XG4gICAgICBjb25zdCBpZCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdpZCcpIHx8IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdyZXNvdXJjZUlkJykgfHwgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2ZpbGVJZCcpO1xuICAgICAgaWYgKGlkKSByZXR1cm4gYXBwZW5kQXV0aChgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2lkfWApO1xuICAgIH1cblxuICAgIHJldHVybiBhcHBlbmRBdXRoKG9yaWdpbmFsVXJsKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBGaWxlIG1ldGFkYXRhIGV4dHJhY3Rpb25cbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vLyAoS2VlcGluZyBleGlzdGluZyBsb2dpYyBmb3IgYnJldml0eSAtIG5vIGNoYW5nZXMgbmVlZGVkIGhlcmUpXG5mdW5jdGlvbiBjbGVhbkF0dGFjaG1lbnROYW1lKHJhd05hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghcmF3TmFtZSkgcmV0dXJuICcnO1xuICBsZXQgbmFtZSA9IHJhd05hbWUudHJpbSgpO1xuICBjb25zdCBnYXJiYWdlTGFiZWxzID0gWydNaWNyb3NvZnQgRXhjZWwnLCAnTWljcm9zb2Z0IFdvcmQnLCAnTWljcm9zb2Z0IFBvd2VyUG9pbnQnLCAnQ29tcHJlc3NlZCBhcmNoaXZlJywgJ0JpbmFyeScsICdVbmtub3duJywgJ0dvb2dsZSBTaGVldHMnLCAnR29vZ2xlIERvY3MnLCAnR29vZ2xlIFNsaWRlcycsICdUZXh0IEZpbGUnLCAnUERGJywgJ1ZpZGVvJywgJ0ltYWdlJywgJ0F1ZGlvJywgJ1RleHQnLCAnV29yZCcsICdFeGNlbCcsICdQb3dlclBvaW50JywgJ0FyY2hpdmUnLCAnWmlwJywgJ0ZpbGUnLCAnRG9jdW1lbnQnLCAnU2hvcnRjdXQnLCAnQ29kZSddO1xuICBmb3IgKGNvbnN0IGxhYmVsIG9mIGdhcmJhZ2VMYWJlbHMpIHtcbiAgICBpZiAobmFtZS5lbmRzV2l0aChsYWJlbCkpIHtcbiAgICAgIGNvbnN0IHBvdGVudGlhbCA9IG5hbWUuc2xpY2UoMCwgLWxhYmVsLmxlbmd0aCkudHJpbSgpO1xuICAgICAgaWYgKHBvdGVudGlhbC5sZW5ndGggPiAwKSB7IG5hbWUgPSBwb3RlbnRpYWw7IGJyZWFrOyB9XG4gICAgfVxuICB9XG4gIGlmIChuYW1lLmxlbmd0aCA+IDAgJiYgbmFtZS5sZW5ndGggJSAyID09PSAwKSB7XG4gICAgY29uc3QgbWlkID0gbmFtZS5sZW5ndGggLyAyO1xuICAgIGlmIChuYW1lLnNsaWNlKDAsIG1pZCkgPT09IG5hbWUuc2xpY2UobWlkKSkgcmV0dXJuIG5hbWUuc2xpY2UoMCwgbWlkKTtcbiAgfVxuICBjb25zdCByZXBlYXRSZWdleCA9IC9cXC4oW2EtekEtWjAtOV17MiwxMH0pXFwxJC9pO1xuICBjb25zdCByZXBlYXRNYXRjaCA9IG5hbWUubWF0Y2gocmVwZWF0UmVnZXgpO1xuICBpZiAocmVwZWF0TWF0Y2gpIHJldHVybiBuYW1lLnNsaWNlKDAsIC1yZXBlYXRNYXRjaFsxXS5sZW5ndGgpLnRyaW0oKTtcbiAgcmV0dXJuIG5hbWU7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RGaWxlTWV0YShjb250YWluZXI6IEhUTUxFbGVtZW50LCB1cmw6IHN0cmluZyk6IEZpbGVNZXRhIHtcbiAgbGV0IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdG9vbHRpcCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtdG9vbHRpcCcpIHx8IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSB8fCBjb250YWluZXIuZ2V0QXR0cmlidXRlKCd0aXRsZScpO1xuICBpZiAodG9vbHRpcCAmJiB0b29sdGlwLnRyaW0oKSkgbmFtZSA9IHRvb2x0aXAudHJpbSgpO1xuICBpZiAoIW5hbWUpIHtcbiAgICBjb25zdCB0ZXh0ID0gKGNvbnRhaW5lci50ZXh0Q29udGVudCB8fCAnJykudHJpbSgpO1xuICAgIGlmICh0ZXh0KSB7XG4gICAgICBjb25zdCBsaW5lcyA9IHRleHQuc3BsaXQoJ1xcbicpLm1hcCgobCkgPT4gbC50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChsaW5lcy5sZW5ndGggPiAwKSBuYW1lID0gbGluZXNbMF07XG4gICAgfVxuICB9XG4gIGlmICghbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1ID0gbmV3IFVSTCh1cmwpO1xuICAgICAgY29uc3QgcGF0aE5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQodS5wYXRobmFtZS5zcGxpdCgnLycpLnBvcCgpIHx8ICcnKTtcbiAgICAgIGlmIChwYXRoTmFtZSAmJiBwYXRoTmFtZS5pbmNsdWRlcygnLicpKSBuYW1lID0gcGF0aE5hbWU7XG4gICAgfSBjYXRjaCB7fVxuICB9XG4gIGlmIChuYW1lKSBuYW1lID0gY2xlYW5BdHRhY2htZW50TmFtZShuYW1lKTtcblxuICBsZXQgZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGlmIChuYW1lKSB7XG4gICAgY29uc3QgbSA9IG5hbWUubWF0Y2goL1xcLihbYS16QS1aMC05XXsyLDEwfSkkLyk7XG4gICAgaWYgKG0pIGV4dCA9IG1bMV0udG9Mb3dlckNhc2UoKTtcbiAgfVxuICAvLyBLaW5kIGxvZ2ljIG9taXR0ZWQgZm9yIGJyZXZpdHksIGFzc3VtZSBpZGVudGljYWwgdG8gcHJldmlvdXMuLi5cbiAgcmV0dXJuIHsgbmFtZSwgZXh0LCBraW5kOiAnb3RoZXInIH07XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gaW5qZWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChjb250YWluZXI6IEhUTUxFbGVtZW50LCB1cmw6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIXVybCkgcmV0dXJuO1xuXG4gIC8vIE1hcmsgYXMgcHJvY2Vzc2VkIChtZXRhZGF0YSBvbmx5KVxuICBjb250YWluZXIuc2V0QXR0cmlidXRlKFBST0NFU1NFRF9BVFRSLCAndHJ1ZScpO1xuXG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY29udGFpbmVyKTtcbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuICBjb25zdCBkaXJlY3RVcmwgPSB0b0Rvd25sb2FkVXJsKHVybCk7XG4gIGNvbnN0IGZpbGVNZXRhID0gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lciwgZGlyZWN0VXJsKTtcbiAgY29uc3QgYnV0dG9uID0gY3JlYXRlRG93bmxvYWRCdXR0b24oY29udGFpbmVyLCBkaXJlY3RVcmwsIGZpbGVNZXRhKTtcblxuICBjb25zdCBpY29uRWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBpZiAoaWNvbkVsKSBpY29uRWwuY2xhc3NMaXN0LmFkZCgnY3FkLWljb24tbWVkaXVtJyk7XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gc3RhdGUgaGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtdHJ5aW5nJykpIHJldHVybiAndHJ5aW5nJztcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykpIHJldHVybiAnc3VjY2Vzcyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtZXJyb3InKSkgcmV0dXJuICdlcnJvcic7XG4gIHJldHVybiAnaWRsZSc7XG59XG5cbmZ1bmN0aW9uIHNldEJ1dHRvblN0YXRlKFxuICBidXR0b246IEhUTUxCdXR0b25FbGVtZW50LFxuICBzdGF0ZTogQnV0dG9uU3RhdGUsXG4gIG9wdGlvbnM/OiB7IHVzZXJNZXNzYWdlPzogc3RyaW5nIH0sXG4pOiB2b2lkIHtcbiAgY29uc3QgaWNvbiA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1pY29uJyk7XG4gIGNvbnN0IGxhYmVsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTFNwYW5FbGVtZW50PignLmNxZC1sYWJlbCcpO1xuICBjb25zdCBlcnJvckRldGFpbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxTcGFuRWxlbWVudD4oJy5jcWQtZXJyb3ItZGV0YWlsJyk7XG4gIGlmICghaWNvbiB8fCAhbGFiZWwgfHwgIWVycm9yRGV0YWlsKSByZXR1cm47XG5cbiAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1sb2FkaW5nJywgJ2NxZC10cnlpbmcnLCAnY3FkLXN1Y2Nlc3MnLCAnY3FkLWVycm9yJyk7XG4gIGljb24uY2xhc3NMaXN0LnJlbW92ZSgnY3FkLXNwaW5uZXInKTtcbiAgaWNvbi50ZXh0Q29udGVudCA9ICcnO1xuICBidXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgYnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcnO1xuICBsYWJlbC50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkJyk7XG4gIGVycm9yRGV0YWlsLnRleHRDb250ZW50ID0gJyc7XG5cbiAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpYDtcbiAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9ICcnO1xuXG4gIHN3aXRjaCAoc3RhdGUpIHtcbiAgICBjYXNlICdpZGxlJzpcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgIGNhc2UgJ3RyeWluZyc6IHtcbiAgICAgIGNvbnN0IGlzVHJ5aW5nID0gc3RhdGUgPT09ICd0cnlpbmcnO1xuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoaXNUcnlpbmcgPyAnY3FkLXRyeWluZycgOiAnY3FkLWxvYWRpbmcnKTtcbiAgICAgIGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGlzVHJ5aW5nID8gdCgndHJ5aW5nJykgOiB0KCdkb3dubG9hZGluZycpO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3Bpbm5lcicpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSAnc3VjY2Vzcyc6XG4gICAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLXN1Y2Nlc3MnKTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gdCgnZG93bmxvYWRlZCcpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtTVUNDRVNTX0lDT05fU1ZHX1VSTH1cIilgO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9ICcyMHB4IDIwcHgnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZXJyb3InOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1lcnJvcicpO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdlcnJvcicpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtFUlJPUl9JQ09OX1NWR19VUkx9XCIpYDtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnMjBweCAyMHB4JztcbiAgICAgIGVycm9yRGV0YWlsLnRleHRDb250ZW50ID0gb3B0aW9ucz8udXNlck1lc3NhZ2UgfHwgdCgnZmFpbGVkJyk7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRQaWxsUHJvZ3Jlc3MoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCwgZnJhY3Rpb246IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgZnJhY3Rpb24gfHwgMCkpO1xuICBidXR0b24uc3R5bGUuc2V0UHJvcGVydHkoJy0tY3FkLXByb2dyZXNzJywgYCR7Y2xhbXBlZCAqIDEwMH0lYCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gZmFjdG9yeVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gY3JlYXRlRG93bmxvYWRCdXR0b24oXG4gIF9jb250YWluZXI6IEhUTUxFbGVtZW50LFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYnRuJztcblxuICBpZiAoaXNQYWdlRGFyaygpKSB7XG4gICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC10aGVtZS1kYXJrJyk7XG4gIH1cblxuICBidXR0b24uc2V0QXR0cmlidXRlKElOSkVDVEVEX0FUVFIsICd0cnVlJyk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBgJHt0KCdhcmlhRG93bmxvYWQnKX0gJHtmaWxlTWV0YS5uYW1lIHx8ICcnfWApO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIHQoJ3RpdGxlUXVpY2snKSk7XG5cbiAgLy8gRGF0YSBmb3IgZ3JvdXBpbmdcbiAgdHJ5IHtcbiAgICBpZiAodXJsKSAoYnV0dG9uLmRhdGFzZXQgYXMgYW55KS5jcWRVcmwgPSB1cmw7XG4gICAgaWYgKGZpbGVNZXRhPy5uYW1lKSAoYnV0dG9uLmRhdGFzZXQgYXMgYW55KS5jcWROYW1lID0gZmlsZU1ldGEubmFtZTtcbiAgICBpZiAoZmlsZU1ldGE/LmV4dCkgKGJ1dHRvbi5kYXRhc2V0IGFzIGFueSkuY3FkRXh0ID0gZmlsZU1ldGEuZXh0O1xuICB9IGNhdGNoIHt9XG5cbiAgY29uc3QgaWNvbldyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25XcmFwcGVyLmNsYXNzTmFtZSA9ICdjcWQtaWNvbi13cmFwcGVyJztcbiAgY29uc3QgaWNvblNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25TcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtaWNvbic7XG4gIGljb25XcmFwcGVyLmFwcGVuZENoaWxkKGljb25TcGFuKTtcblxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NxZC1sYWJlbCc7XG4gIGxhYmVsLnRleHRDb250ZW50ID0gdCgnZG93bmxvYWQnKTtcblxuICBjb25zdCBlcnJvckRldGFpbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgZXJyb3JEZXRhaWwuY2xhc3NOYW1lID0gJ2NxZC1lcnJvci1kZXRhaWwnO1xuXG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChpY29uV3JhcHBlcik7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChsYWJlbCk7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChlcnJvckRldGFpbCk7XG5cbiAgY29uc3QgY2xpY2tIYW5kbGVyID0gYXN5bmMgKGU6IEV2ZW50KSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYXdhaXQgaGFuZGxlU2luZ2xlRG93bmxvYWRDbGljayhidXR0b24sIHVybCwgZmlsZU1ldGEpO1xuICB9O1xuXG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNsaWNrSGFuZGxlcik7XG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdhdXhjbGljaycsIChlKSA9PiB7IGlmIChlLmJ1dHRvbiA9PT0gMSkgY2xpY2tIYW5kbGVyKGUpOyB9KTtcblxuICByZXR1cm4gYnV0dG9uO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRG93bmxvYWQgY2xpY2sgaGFuZGxlclxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2luZ2xlRG93bmxvYWRDbGljayhcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgdXJsOiBzdHJpbmcsXG4gIGZpbGVNZXRhOiBGaWxlTWV0YSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXVybCkgcmV0dXJuO1xuICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSAhPT0gJ2lkbGUnKSByZXR1cm47XG5cbiAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMCk7XG5cbiAgY29uc3QgcmVxdWVzdElkID0gYGNxZC0ke0RhdGUubm93KCl9LSR7bmV4dFJlcXVlc3RTZXErK31gO1xuICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuXG4gIHBlbmRpbmdCdXR0b25zLnNldChyZXF1ZXN0SWQsIHsgYnV0dG9uLCByZXF1ZXN0SWQsIGZpbGVNZXRhLCBzdGFydGVkQXQgfSk7XG5cbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnbG9hZGluZycpO1xuXG4gIGNvbnN0IHN0YXJ0UmVzdWx0ID0gYXdhaXQgc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQocmVxdWVzdElkLCB1cmwsIGZpbGVNZXRhKTtcblxuICBpZiAoIXN0YXJ0UmVzdWx0Lm9rKSB7XG4gICAgcGVuZGluZ0J1dHRvbnMuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgYXdhaXQgZW5zdXJlTWluTG9hZGluZyhzdGFydGVkQXQpO1xuICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgc3RhcnRSZXN1bHQudXNlck1lc3NhZ2UpO1xuICAgIHJldHVybjtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdGFydEJhY2tncm91bmREb3dubG9hZChcbiAgcmVxdWVzdElkOiBzdHJpbmcsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IHVzZXJNZXNzYWdlPzogc3RyaW5nIH0+IHtcbiAgY29uc3QgZmluYWxVcmwgPSB0b0Rvd25sb2FkVXJsKHVybCk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2hyb21lID09PSAndW5kZWZpbmVkJyB8fCAhY2hyb21lLnJ1bnRpbWU/LnNlbmRNZXNzYWdlKSB7XG4gICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogJ1J1bnRpbWUgbm90IGF2YWlsYWJsZS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoXG4gICAgICAgIHsgdHlwZTogJ0NRRF9ET1dOTE9BRCcsIHVybDogZmluYWxVcmwsIHJlcXVlc3RJZCwgZmlsZU1ldGEgfSxcbiAgICAgICAgKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvciB8fCAhcmVzcG9uc2UgfHwgcmVzcG9uc2Uuc3RhcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJlc29sdmUoeyBvazogZmFsc2UsIHVzZXJNZXNzYWdlOiByZXNwb25zZT8udXNlck1lc3NhZ2UgfHwgJ0NvdWxkIG5vdCBzdGFydC4nIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXNvbHZlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJlc29sdmUoeyBvazogZmFsc2UsIHVzZXJNZXNzYWdlOiAnQ29tbSBlcnJvci4nIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBVSSBVdGlsc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuYXN5bmMgZnVuY3Rpb24gc2hvd0Vycm9yU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCwgdXNlck1lc3NhZ2U/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnZXJyb3InLCB7IHVzZXJNZXNzYWdlIH0pO1xuICBjb25zdCBlYXJsaWVzdFJlc2V0ID0gRGF0ZS5ub3coKSArIEZFRURCQUNLX0VSUk9SX01TO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGF3YWl0IGRlbGF5KDIwMCk7XG4gICAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdlcnJvcicpIHJldHVybjtcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGVhcmxpZXN0UmVzZXQpIGNvbnRpbnVlO1xuICAgIGlmICghYnV0dG9uLm1hdGNoZXMoJzpob3ZlcicpKSB7XG4gICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG4gICAgICBzZXRQaWxsUHJvZ3Jlc3MoYnV0dG9uLCAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlTWluTG9hZGluZyhzdGFydGVkQXQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdDtcbiAgaWYgKGVsYXBzZWQgPCBMT0FESU5HX01JTl9NUykgYXdhaXQgZGVsYXkoTE9BRElOR19NSU5fTVMgLSBlbGFwc2VkKTtcbn1cblxuZnVuY3Rpb24gZGVsYXkobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBMaXN0ZW4gZm9yIGJhY2tncm91bmQgc3RhdHVzIHVwZGF0ZXNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiBjaHJvbWUucnVudGltZT8ub25NZXNzYWdlKSB7XG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSkgPT4ge1xuICAgIGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnR5cGUgIT09ICdDUURfRE9XTkxPQURfU1RBVFVTJykgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVxdWVzdElkID0gbWVzc2FnZS5yZXF1ZXN0SWQgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmICghcmVxdWVzdElkKSByZXR1cm47XG5cbiAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ0J1dHRvbnMuZ2V0KHJlcXVlc3RJZCk7XG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm47XG5cbiAgICBjb25zdCB7IGJ1dHRvbiwgc3RhcnRlZEF0IH0gPSBwZW5kaW5nO1xuXG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcblxuICAgICAgY29uc3Qgc3RhdHVzID0gbWVzc2FnZS5zdGF0dXMgYXMgQnV0dG9uU3RhdGUgfCAnYmxvY2tlZF9odG1sJyB8ICdpbnRlcnJ1cHRlZCc7XG4gICAgICBjb25zdCBlcnJvckNvZGUgPSBtZXNzYWdlLmVycm9yQ29kZSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IG1lc3NhZ2UudXNlck1lc3NhZ2UgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoc3RhdHVzID09PSAndHJ5aW5nJykge1xuICAgICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICd0cnlpbmcnLCB7IHVzZXJNZXNzYWdlIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFNVQ0NFU1MgUEFUSFxuICAgICAgaWYgKHN0YXR1cyA9PT0gJ3N1Y2Nlc3MnIHx8IHN0YXR1cyA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgICBwZW5kaW5nQnV0dG9ucy5kZWxldGUocmVxdWVzdElkKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIChidXR0b24uZGF0YXNldCBhcyBhbnkpLmNxZEFsbERvbmUgPSAndHJ1ZSc7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMSk7XG4gICAgICAgIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICAvLyBTdGF5IGdyZWVuIHVudGlsIHRoZSBncm91cCBiYXRjaCBoYXMgZmluaXNoZWQgaXRzIHN1Y2Nlc3Mgd2luZG93XG4gICAgICAgIGF3YWl0IHdhaXRGb3JTdWNjZXNzUmVzZXQoYnV0dG9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdHVzID09PSAnZXJyb3InIHx8IHN0YXR1cyA9PT0gJ2ludGVycnVwdGVkJyB8fCBzdGF0dXMgPT09ICdibG9ja2VkX2h0bWwnKSB7XG4gICAgICAgIGlmIChlcnJvckNvZGUgPT09ICdBVVRIX0NIRUNLJykge1xuICAgICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwZW5kaW5nQnV0dG9ucy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMCk7XG4gICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH0pKCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbml0Q29udGVudFNjcmlwdCgpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFN0eWxlcygpO1xuICBzZXR1cE9ic2VydmVycygpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHsgaW5pdENvbnRlbnRTY3JpcHQoKTsgfSxcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiB3YWl0Rm9yU3VjY2Vzc1Jlc2V0KGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZWFybGllc3RSZXNldCA9IERhdGUubm93KCkgKyBGRUVEQkFDS19TVUNDRVNTX01TO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgYXdhaXQgZGVsYXkoMjAwKTtcblxuICAgIGlmIChnZXRCdXR0b25TdGF0ZShidXR0b24pICE9PSAnc3VjY2VzcycpIHtcbiAgICAgIHJldHVybjsgLy8gc29tZXRoaW5nIGVsc2UgY2hhbmdlZCB0aGUgc3RhdGVcbiAgICB9XG5cbiAgICAvLyBSZXNwZWN0IG1pbmltdW0gdmlzaWJsZSBzdWNjZXNzIHRpbWVcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGVhcmxpZXN0UmVzZXQpIGNvbnRpbnVlO1xuXG4gICAgLy8gSWYgdGhpcyBidXR0b24gaXMgcGFydCBvZiBhbiBhY3RpdmUgXCJEb3dubG9hZCBhbGxcIiBiYXRjaCwgc3RheSBncmVlblxuICAgIGNvbnN0IHBvc3RSb290ID1cbiAgICAgIGJ1dHRvbi5jbG9zZXN0PEhUTUxFbGVtZW50PignZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJykgfHxcbiAgICAgIGJ1dHRvbi5jbG9zZXN0PEhUTUxFbGVtZW50PignbWFpbicpIHx8XG4gICAgICBidXR0b24uY2xvc2VzdDxIVE1MRWxlbWVudD4oJ2Rpdltyb2xlPVwibWFpblwiXScpO1xuXG4gICAgaWYgKHBvc3RSb290ICYmIHBvc3RSb290LmRhdGFzZXQuY3FkR3JvdXBBY3RpdmUgPT09ICcxJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3Qgc25hcCBiYWNrIHdoaWxlIHRoZSB1c2VyIGlzIGhvdmVyaW5nXG4gICAgaWYgKGJ1dHRvbi5tYXRjaGVzKCc6aG92ZXInKSkgY29udGludWU7XG5cbiAgICBicmVhaztcbiAgfVxuXG4gIC8vIEZpbmFsbHkgcmVzZXQgYmFjayB0byBub3JtYWwgYmx1ZSBwaWxsXG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2lkbGUnKTtcbiAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMCk7XG4gIHRyeSB7XG4gICAgZGVsZXRlIChidXR0b24uZGF0YXNldCBhcyBhbnkpLmNxZEFsbERvbmU7XG4gIH0gY2F0Y2gge1xuICAgIC8qIGlnbm9yZSAqL1xuICB9XG59XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVM5QixRQUFNLHVCQUF1QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFVN0IsUUFBTSxxQkFBcUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBUTNCLFFBQU0sd0JBQXdCLDJCQUEyQjtBQUFBLElBQzlEO0FBQUEsRUFDRixDQUFDO0FBRU0sUUFBTSx1QkFBdUIsMkJBQTJCO0FBQUEsSUFDN0Q7QUFBQSxFQUNGLENBQUM7QUFFTSxRQUFNLHFCQUFxQiwyQkFBMkI7QUFBQSxJQUMzRDtBQUFBLEVBQ0YsQ0FBQztBQ3BDRCxRQUFNLFdBQVc7QUFDakIsUUFBTSxrQkFBa0I7QUFFeEIsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxpQkFBaUIsR0FBRyxhQUFhO0FBRWhDLFdBQVMsZUFBcUI7QUFDbkMsUUFBSSxPQUFPLGFBQWEsWUFBYTtBQUNyQyxRQUFJLFNBQVMsZUFBZSxRQUFRLEVBQUc7QUFFdkMsVUFBTSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLFVBQU0sS0FBSztBQUNYLFVBQU0sY0FBYztBQUFBO0FBQUEsMEJBRUksY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFvSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBZ1pBLHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFpQmhELEtBQUE7QUFFRixLQUFDLFNBQVMsUUFBUSxTQUFTLGlCQUFpQixZQUFZLEtBQUs7QUFBQSxFQUMvRDtBQzVzQkEsUUFBTSxlQUFvQztBQUFBLElBQ3hDLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxNQUNSLGFBQWE7QUFBQSxJQUFBO0FBQUEsSUFFZixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsSUFBQTtBQUFBLElBRWYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLFNBQVM7QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixTQUFTO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsU0FBUztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixLQUFLO0FBQUEsTUFDSCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxFQUVaO0FBSU8sV0FBUyxFQUFFLEtBQXNCO0FBQ3RDLFFBQUk7QUFDRixVQUFJLENBQUMsT0FBTyxPQUFPLFFBQVEsVUFBVTtBQUNuQyxlQUFPO0FBQUEsTUFDVDtBQUVBLFVBQUksVUFBVTtBQUNkLFVBQ0UsT0FBTyxhQUFhLGVBQ3BCLFNBQVMsbUJBQ1QsU0FBUyxnQkFBZ0IsTUFDekI7QUFDQSxrQkFBVSxTQUFTLGdCQUFnQjtBQUFBLE1BQ3JDLFdBQVcsT0FBTyxjQUFjLGVBQWUsVUFBVSxVQUFVO0FBQ2pFLGtCQUFVLFVBQVU7QUFBQSxNQUN0QjtBQUVBLFlBQU0saUJBQWlCLFFBQ3BCLFlBQUEsRUFDQSxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQ1osS0FBQSxFQUNBLFFBQVEsS0FBSyxHQUFHO0FBQ25CLFlBQU0sV0FBVyxlQUFlLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFNUMsVUFDRSxhQUFhLGNBQWMsS0FDM0IsT0FBTyxhQUFhLGNBQWMsRUFBRSxHQUFHLE1BQU0sVUFDN0M7QUFDQSxlQUFPLGFBQWEsY0FBYyxFQUFFLEdBQUc7QUFBQSxNQUN6QztBQUVBLFVBQ0UsYUFBYSxRQUFRLEtBQ3JCLE9BQU8sYUFBYSxRQUFRLEVBQUUsR0FBRyxNQUFNLFVBQ3ZDO0FBQ0EsZUFBTyxhQUFhLFFBQVEsRUFBRSxHQUFHO0FBQUEsTUFDbkM7QUFFQSxVQUNFLGFBQWEsSUFBSSxLQUNqQixPQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUcsTUFBTSxVQUNuQztBQUNBLGVBQU8sYUFBYSxJQUFJLEVBQUUsR0FBRztBQUFBLE1BQy9CO0FBRUEsYUFBTztBQUFBLElBQ1QsUUFBUTtBQUNOLFVBQUk7QUFDRixlQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUcsS0FBSztBQUFBLE1BQ3BDLFFBQVE7QUFDTixlQUFPLE9BQU8sT0FBTyxVQUFVO0FBQUEsTUFDakM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQ2g3Qk8sV0FBUyxhQUFzQjtBQUNwQyxRQUFJLE9BQU8sYUFBYSxZQUFhLFFBQU87QUFHNUMsVUFBTSxXQUFXLFNBQVMsZ0JBQWdCLGFBQWEsd0JBQXdCO0FBQy9FLFFBQUksYUFBYSxPQUFRLFFBQU87QUFDaEMsUUFBSSxhQUFhLFFBQVMsUUFBTztBQUlqQyxVQUFNLGFBQWEsQ0FBQyxRQUFRLGNBQWMsY0FBYyxTQUFTLGdCQUFnQjtBQUNqRixVQUFNLGFBQWEsU0FBUyxnQkFBZ0IsYUFBYSxJQUFJLFlBQUE7QUFDN0QsVUFBTSxhQUFhLFNBQVMsS0FBSyxhQUFhLElBQUksWUFBQTtBQUNsRCxRQUFJLFdBQVcsS0FBSyxDQUFBLFVBQVMsVUFBVSxTQUFTLEtBQUssS0FBSyxVQUFVLFNBQVMsS0FBSyxDQUFDLEdBQUc7QUFDcEYsYUFBTztBQUFBLElBQ1Q7QUFJQSxVQUFNLFVBQ0osU0FBUyxjQUEyQiwwQkFBMEIsS0FDOUQsU0FBUyxjQUEyQixlQUFlLEtBQ25ELFNBQVM7QUFFWCxVQUFNLFVBQVUsNEJBQTRCLE9BQU87QUFDbkQsVUFBTSxhQUFhLGdCQUFnQixPQUFPO0FBSzFDLFdBQU8sYUFBYTtBQUFBLEVBQ3RCO0FBTUEsV0FBUyw0QkFBNEIsT0FBNEI7QUFDL0QsUUFBSSxLQUF5QjtBQUU3QixVQUFNLGdCQUFnQixDQUFDLE1BQ3JCLENBQUMsS0FBSyxNQUFNLGlCQUFpQixNQUFNO0FBRXJDLFdBQU8sSUFBSTtBQUNULFlBQU0sUUFBUSxPQUFPLGlCQUFpQixFQUFFO0FBQ3hDLFlBQU0sS0FBSyxNQUFNO0FBQ2pCLFVBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRyxRQUFPO0FBQy9CLFdBQUssR0FBRztBQUFBLElBQ1Y7QUFHQSxVQUFNLFlBQVksT0FBTyxpQkFBaUIsU0FBUyxlQUFlO0FBQ2xFLFVBQU0sU0FBUyxVQUFVO0FBQ3pCLFFBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRyxRQUFPO0FBR25DLFdBQU87QUFBQSxFQUNUO0FBTUEsV0FBUyxnQkFBZ0IsV0FBMkI7QUFDbEQsVUFBTSxRQUFRLFVBQVUsTUFBTSx5QkFBeUI7QUFDdkQsUUFBSSxDQUFDLE9BQU87QUFFVixhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sSUFBSSxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDL0IsVUFBTSxJQUFJLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUMvQixVQUFNLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBRy9CLFVBQU0sYUFBYSxLQUFLO0FBQUEsTUFDdEIsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJO0FBQUEsSUFBQTtBQUdmLFdBQU87QUFBQSxFQUNUO0FDaEdBLFFBQUEsd0JBQUE7QUFZQSxRQUFBLGdCQUFBO0FBQ0EsUUFBQSxpQkFBQTtBQUNBLFFBQUEscUJBQUE7QUFDQSxRQUFBLHFCQUFBO0FBQ0EsUUFBQSxpQkFBQTtBQUNBLFFBQUEsc0JBQUE7QUFDQSxRQUFBLG9CQUFBO0FBRUEsUUFBQSx3QkFBQTtBQUdBLFFBQUEsZ0NBQUE7QUFBQSxJQUFzQztBQUFBLElBQ3BDO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFFRixFQUFBLEtBQUEsSUFBQTtBQUVBLFFBQUEscUJBQUE7QUFBQSxJQUFxQztBQUFBLElBQ25DO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUVGO0FBUUEsTUFBQSxnQkFBQTtBQUNBLE1BQUEsV0FBQTtBQWlCQSxNQUFBLGlCQUFBO0FBQ0EsUUFBQSxpQkFBQSxvQkFBQSxJQUFBO0FBTUEsV0FBQSxvQkFBQTtBQUNFLFFBQUEsT0FBQSxhQUFBLFlBQUEsUUFBQTtBQUNBLFFBQUEsU0FBQSxhQUFBLHVCQUFBLFFBQUE7QUFDQSxXQUFBLHNCQUFBLEtBQUEsU0FBQSxJQUFBO0FBQUEsRUFDRjtBQU1BLFdBQUEsZUFBQTtBQUNFLFFBQUEsa0JBQUEsTUFBQTtBQUNFLGFBQUEsYUFBQSxhQUFBO0FBQUEsSUFBaUM7QUFFbkMsb0JBQUEsT0FBQSxXQUFBLE1BQUE7QUFDRSxzQkFBQTtBQUNBLHlCQUFBLFFBQUE7QUFBQSxJQUEyQixHQUFBLGtCQUFBO0FBQUEsRUFFL0I7QUFFQSxXQUFBLGlCQUFBO0FBQ0UsUUFBQSxPQUFBLGFBQUEsWUFBQTtBQUVBLFFBQUEsQ0FBQSxTQUFBLE1BQUE7QUFDRSxhQUFBO0FBQUEsUUFBTztBQUFBLFFBQ0wsTUFBQSxlQUFBO0FBQUEsUUFDcUIsRUFBQSxNQUFBLEtBQUE7QUFBQSxNQUNSO0FBRWY7QUFBQSxJQUFBO0FBRUYsUUFBQSxTQUFBO0FBRUEsZUFBQSxJQUFBLGlCQUFBLENBQUEsY0FBQTtBQUNFLFlBQUEsUUFBQSxvQkFBQSxJQUFBO0FBQ0EsVUFBQSxhQUFBO0FBRUEsaUJBQUEsS0FBQSxXQUFBO0FBQ0UsWUFBQSxFQUFBLFNBQUEsWUFBQTtBQUdBLGNBQUEsYUFBQSxNQUFBLEtBQUEsRUFBQSxVQUFBLEVBQUE7QUFBQSxVQUE0QyxDQUFBLE1BQUEsRUFBQSxhQUFBLEtBQUEsZ0JBQUEsRUFBQSxhQUFBLGFBQUE7QUFBQSxRQUVEO0FBRTNDLFlBQUEsV0FBQTtBQUVBLHFCQUFBO0FBQ0EsVUFBQSxXQUFBLFFBQUEsQ0FBQSxTQUFBO0FBQ0UsY0FBQSxLQUFBLGFBQUEsS0FBQSxjQUFBO0FBQ0Usa0JBQUEsSUFBQSxJQUFBO0FBQUEsVUFBNkI7QUFBQSxRQUMvQixDQUFBO0FBQUEsTUFDRDtBQUdILFVBQUEsWUFBQTtBQUNFLFlBQUEsTUFBQSxTQUFBLEdBQUE7QUFDRSx1QkFBQTtBQUFBLFFBQWEsT0FBQTtBQUViLGdCQUFBLFFBQUEsQ0FBQSxTQUFBLG1CQUFBLElBQUEsQ0FBQTtBQUFBLFFBQWdEO0FBQUEsTUFDbEQ7QUFBQSxJQUNGLENBQUE7QUFHRixhQUFBLFFBQUEsU0FBQSxNQUFBO0FBQUEsTUFBZ0MsV0FBQTtBQUFBLE1BQ25CLFNBQUE7QUFBQSxJQUNGLENBQUE7QUFHWCxXQUFBLFlBQUEsTUFBQTtBQUNFLG1CQUFBO0FBQUEsSUFBYSxHQUFBLGtCQUFBO0FBR2YsaUJBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxtQkFBQSxPQUFBLFVBQUE7QUFDRSxRQUFBLENBQUEsa0JBQUEsRUFBQTtBQUNBLDRCQUFBLElBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSx3QkFBQSxPQUFBLFVBQUE7QUFDRSxVQUFBLFVBQUEsTUFBQTtBQUFBLE1BQXNCLEtBQUEsaUJBQUEscUJBQUE7QUFBQSxJQUMwQztBQUdoRSxlQUFBLFVBQUEsU0FBQTtBQUNFLFlBQUEsTUFBQSwwQkFBQSxNQUFBO0FBQ0EsVUFBQSxDQUFBLElBQUE7QUFFQSxZQUFBLFlBQUEsT0FBQSxRQUFBLDZCQUFBLEtBQUEsT0FBQSxpQkFBQTtBQUtBLFVBQUEsQ0FBQSxVQUFBO0FBS0EsVUFBQSxrQkFBQSxTQUFBLEVBQUE7QUFFQSxpQ0FBQSxXQUFBLEdBQUE7QUFBQSxJQUF5QztBQUkzQyxVQUFBLGVBQUEsTUFBQTtBQUFBLE1BQTJCLEtBQUE7QUFBQSxRQUNwQjtBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBR0YsZUFBQSxNQUFBLGNBQUE7QUFDRSxVQUFBLGtCQUFBLEVBQUEsRUFBQTtBQUVBLFlBQUEsTUFBQSxhQUFBLEVBQUE7QUFDQSxVQUFBLENBQUEsSUFBQTtBQUVBLGlDQUFBLElBQUEsR0FBQTtBQUFBLElBQWtDO0FBQUEsRUFFdEM7QUFNQSxXQUFBLGtCQUFBLFdBQUE7QUFFRSxXQUFBLENBQUEsQ0FBQSxVQUFBLGNBQUEsSUFBQSxhQUFBLFVBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSwwQkFBQSxRQUFBO0FBQ0UsVUFBQSxPQUFBLE9BQUE7QUFDQSxRQUFBLENBQUEsS0FBQSxRQUFBO0FBQ0EsV0FBQSxtQkFBQSxLQUFBLENBQUEsT0FBQSxHQUFBLEtBQUEsSUFBQSxDQUFBLElBQUEsT0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGFBQUEsU0FBQTtBQUNFLFVBQUEsYUFBQSxRQUFBLGNBQUEscUJBQUEsS0FBQSxRQUFBLFFBQUEscUJBQUE7QUFJQSxRQUFBLFlBQUE7QUFDRSxZQUFBLE9BQUEsMEJBQUEsVUFBQTtBQUNBLFVBQUEsS0FBQSxRQUFBO0FBQUEsSUFBaUI7QUFHbkIsVUFBQSxVQUFBLFFBQUEsYUFBQSxlQUFBLEtBQUEsUUFBQSxhQUFBLFNBQUE7QUFFQSxRQUFBLFNBQUE7QUFDRSxhQUFBO0FBQUEsUUFBTyxrREFBQTtBQUFBLFVBQzZDO0FBQUEsUUFDaEQsQ0FBQTtBQUFBLE1BQ0Q7QUFBQSxJQUNIO0FBRUYsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGNBQUE7QUFDRSxRQUFBLE9BQUEsV0FBQSxZQUFBLFFBQUE7QUFDQSxVQUFBLFNBQUEsSUFBQSxnQkFBQSxPQUFBLFNBQUEsTUFBQTtBQUNBLFFBQUEsT0FBQSxJQUFBLFVBQUEsRUFBQSxRQUFBLE9BQUEsSUFBQSxVQUFBO0FBQ0EsUUFBQSxPQUFBLElBQUEsR0FBQSxFQUFBLFFBQUEsT0FBQSxJQUFBLEdBQUE7QUFDQSxVQUFBLFlBQUEsT0FBQSxTQUFBLFNBQUEsTUFBQSxjQUFBO0FBQ0EsUUFBQSxVQUFBLFFBQUEsVUFBQSxDQUFBO0FBQ0EsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGNBQUEsYUFBQSxRQUFBLEdBQUE7QUFDRSxRQUFBLFFBQUEsRUFBQSxRQUFBO0FBQ0EsVUFBQSxXQUFBLFlBQUE7QUFFQSxRQUFBO0FBQ0UsWUFBQSxTQUFBLElBQUEsSUFBQSxhQUFBLFNBQUEsSUFBQTtBQUNBLFlBQUEsYUFBQSxDQUFBLE1BQUE7QUFDRSxZQUFBLENBQUEsU0FBQSxRQUFBO0FBQ0EsY0FBQSxPQUFBLElBQUEsSUFBQSxDQUFBO0FBQ0EsWUFBQSxDQUFBLEtBQUEsYUFBQSxJQUFBLFVBQUEsR0FBQTtBQUNFLGVBQUEsYUFBQSxJQUFBLFlBQUEsUUFBQTtBQUFBLFFBQTBDO0FBRTVDLGVBQUEsS0FBQSxTQUFBO0FBQUEsTUFBcUI7QUFHdkIsVUFBQSxPQUFBLGFBQUEsb0JBQUE7QUFDRSxZQUFBLE9BQUEsU0FBQSxXQUFBLGNBQUEsR0FBQTtBQUNFLGdCQUFBLE9BQUEsT0FBQSxhQUFBLElBQUEsVUFBQTtBQUNBLGNBQUEsS0FBQSxRQUFBLGNBQUEsTUFBQSxRQUFBLENBQUE7QUFDQSxnQkFBQSxLQUFBLE9BQUEsYUFBQSxJQUFBLElBQUE7QUFDQSxjQUFBLEdBQUEsUUFBQSxXQUFBLGtEQUFBLEVBQUEsRUFBQTtBQUNBLGlCQUFBLFdBQUEsV0FBQTtBQUFBLFFBQTZCO0FBRS9CLGNBQUEsWUFBQSxPQUFBLFNBQUEsTUFBQSxxQkFBQTtBQUNBLFlBQUEsV0FBQTtBQUNFLGlCQUFBLFdBQUEsa0RBQUEsVUFBQSxDQUFBLENBQUEsRUFBQTtBQUFBLFFBQWtGO0FBRXBGLFlBQUEsT0FBQSxhQUFBLFdBQUEsT0FBQSxhQUFBLE9BQUE7QUFDRSxpQkFBQSxhQUFBLElBQUEsVUFBQSxVQUFBO0FBQ0EsY0FBQSxTQUFBLFFBQUEsYUFBQSxJQUFBLFlBQUEsUUFBQTtBQUNBLGlCQUFBLE9BQUEsU0FBQTtBQUFBLFFBQXVCO0FBQUEsTUFDekI7QUFHRixVQUFBLE9BQUEsYUFBQSwwQkFBQSxPQUFBLFNBQUEsV0FBQSxRQUFBLEdBQUE7QUFDRSxjQUFBLEtBQUEsT0FBQSxhQUFBLElBQUEsSUFBQSxLQUFBLE9BQUEsYUFBQSxJQUFBLFlBQUEsS0FBQSxPQUFBLGFBQUEsSUFBQSxRQUFBO0FBQ0EsWUFBQSxHQUFBLFFBQUEsV0FBQSxrREFBQSxFQUFBLEVBQUE7QUFBQSxNQUFnRjtBQUdsRixhQUFBLFdBQUEsV0FBQTtBQUFBLElBQTZCLFFBQUE7QUFFN0IsYUFBQTtBQUFBLElBQU87QUFBQSxFQUVYO0FBTUEsV0FBQSxvQkFBQSxTQUFBO0FBQ0UsUUFBQSxDQUFBLFFBQUEsUUFBQTtBQUNBLFFBQUEsT0FBQSxRQUFBLEtBQUE7QUFDQSxVQUFBLGdCQUFBLENBQUEsbUJBQUEsa0JBQUEsd0JBQUEsc0JBQUEsVUFBQSxXQUFBLGlCQUFBLGVBQUEsaUJBQUEsYUFBQSxPQUFBLFNBQUEsU0FBQSxTQUFBLFFBQUEsUUFBQSxTQUFBLGNBQUEsV0FBQSxPQUFBLFFBQUEsWUFBQSxZQUFBLE1BQUE7QUFDQSxlQUFBLFNBQUEsZUFBQTtBQUNFLFVBQUEsS0FBQSxTQUFBLEtBQUEsR0FBQTtBQUNFLGNBQUEsWUFBQSxLQUFBLE1BQUEsR0FBQSxDQUFBLE1BQUEsTUFBQSxFQUFBLEtBQUE7QUFDQSxZQUFBLFVBQUEsU0FBQSxHQUFBO0FBQTRCLGlCQUFBO0FBQWtCO0FBQUEsUUFBQTtBQUFBLE1BQU87QUFBQSxJQUN2RDtBQUVGLFFBQUEsS0FBQSxTQUFBLEtBQUEsS0FBQSxTQUFBLE1BQUEsR0FBQTtBQUNFLFlBQUEsTUFBQSxLQUFBLFNBQUE7QUFDQSxVQUFBLEtBQUEsTUFBQSxHQUFBLEdBQUEsTUFBQSxLQUFBLE1BQUEsR0FBQSxFQUFBLFFBQUEsS0FBQSxNQUFBLEdBQUEsR0FBQTtBQUFBLElBQW9FO0FBRXRFLFVBQUEsY0FBQTtBQUNBLFVBQUEsY0FBQSxLQUFBLE1BQUEsV0FBQTtBQUNBLFFBQUEsWUFBQSxRQUFBLEtBQUEsTUFBQSxHQUFBLENBQUEsWUFBQSxDQUFBLEVBQUEsTUFBQSxFQUFBLEtBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsZ0JBQUEsV0FBQSxLQUFBO0FBQ0UsUUFBQTtBQUNBLFVBQUEsVUFBQSxVQUFBLGFBQUEsY0FBQSxLQUFBLFVBQUEsYUFBQSxZQUFBLEtBQUEsVUFBQSxhQUFBLE9BQUE7QUFDQSxRQUFBLFdBQUEsUUFBQSxLQUFBLEVBQUEsUUFBQSxRQUFBLEtBQUE7QUFDQSxRQUFBLENBQUEsTUFBQTtBQUNFLFlBQUEsUUFBQSxVQUFBLGVBQUEsSUFBQSxLQUFBO0FBQ0EsVUFBQSxNQUFBO0FBQ0UsY0FBQSxRQUFBLEtBQUEsTUFBQSxJQUFBLEVBQUEsSUFBQSxDQUFBLE1BQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxPQUFBLE9BQUE7QUFDQSxZQUFBLE1BQUEsU0FBQSxFQUFBLFFBQUEsTUFBQSxDQUFBO0FBQUEsTUFBb0M7QUFBQSxJQUN0QztBQUVGLFFBQUEsQ0FBQSxNQUFBO0FBQ0UsVUFBQTtBQUNFLGNBQUEsSUFBQSxJQUFBLElBQUEsR0FBQTtBQUNBLGNBQUEsV0FBQSxtQkFBQSxFQUFBLFNBQUEsTUFBQSxHQUFBLEVBQUEsSUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLFlBQUEsU0FBQSxTQUFBLEdBQUEsRUFBQSxRQUFBO0FBQUEsTUFBK0MsUUFBQTtBQUFBLE1BQ3pDO0FBQUEsSUFBQztBQUVYLFFBQUEsS0FBQSxRQUFBLG9CQUFBLElBQUE7QUFFQSxRQUFBO0FBQ0EsUUFBQSxNQUFBO0FBQ0UsWUFBQSxJQUFBLEtBQUEsTUFBQSx3QkFBQTtBQUNBLFVBQUEsRUFBQSxPQUFBLEVBQUEsQ0FBQSxFQUFBLFlBQUE7QUFBQSxJQUE4QjtBQUdoQyxXQUFBLEVBQUEsTUFBQSxLQUFBLE1BQUEsUUFBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLDJCQUFBLFdBQUEsS0FBQTtBQUNFLFFBQUEsQ0FBQSxJQUFBO0FBR0EsY0FBQSxhQUFBLGdCQUFBLE1BQUE7QUFFQSxVQUFBLFdBQUEsT0FBQSxpQkFBQSxTQUFBO0FBQ0EsUUFBQSxTQUFBLGFBQUEsU0FBQSxXQUFBLE1BQUEsV0FBQTtBQUVBLFVBQUEsWUFBQSxjQUFBLEdBQUE7QUFDQSxVQUFBLFdBQUEsZ0JBQUEsV0FBQSxTQUFBO0FBQ0EsVUFBQSxTQUFBLHFCQUFBLFdBQUEsV0FBQSxRQUFBO0FBRUEsVUFBQSxTQUFBLE9BQUEsY0FBQSxvQkFBQTtBQUNBLFFBQUEsT0FBQSxRQUFBLFVBQUEsSUFBQSxpQkFBQTtBQUVBLGNBQUEsWUFBQSxNQUFBO0FBQUEsRUFDRjtBQU1BLFdBQUEsZUFBQSxRQUFBO0FBQ0UsUUFBQSxPQUFBLFVBQUEsU0FBQSxhQUFBLEVBQUEsUUFBQTtBQUNBLFFBQUEsT0FBQSxVQUFBLFNBQUEsWUFBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE9BQUEsVUFBQSxTQUFBLGFBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxPQUFBLFVBQUEsU0FBQSxXQUFBLEVBQUEsUUFBQTtBQUNBLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxlQUFBLFFBQUEsT0FBQSxTQUFBO0FBS0UsVUFBQSxPQUFBLE9BQUEsY0FBQSxvQkFBQTtBQUNBLFVBQUEsUUFBQSxPQUFBLGNBQUEsWUFBQTtBQUNBLFVBQUEsY0FBQSxPQUFBLGNBQUEsbUJBQUE7QUFDQSxRQUFBLENBQUEsUUFBQSxDQUFBLFNBQUEsQ0FBQSxZQUFBO0FBRUEsV0FBQSxVQUFBLE9BQUEsZUFBQSxjQUFBLGVBQUEsV0FBQTtBQUNBLFNBQUEsVUFBQSxPQUFBLGFBQUE7QUFDQSxTQUFBLGNBQUE7QUFDQSxXQUFBLFdBQUE7QUFDQSxXQUFBLE1BQUEsa0JBQUE7QUFDQSxVQUFBLGNBQUEsRUFBQSxVQUFBO0FBQ0EsZ0JBQUEsY0FBQTtBQUVBLFNBQUEsTUFBQSxrQkFBQSxRQUFBLHFCQUFBO0FBQ0EsU0FBQSxNQUFBLGlCQUFBO0FBRUEsWUFBQSxPQUFBO0FBQUEsTUFBZSxLQUFBO0FBRVg7QUFBQSxNQUFBLEtBQUE7QUFBQSxNQUNHLEtBQUEsVUFBQTtBQUVILGNBQUEsV0FBQSxVQUFBO0FBQ0EsZUFBQSxVQUFBLElBQUEsV0FBQSxlQUFBLGFBQUE7QUFDQSxlQUFBLFdBQUE7QUFDQSxjQUFBLGNBQUEsV0FBQSxFQUFBLFFBQUEsSUFBQSxFQUFBLGFBQUE7QUFDQSxhQUFBLFVBQUEsSUFBQSxhQUFBO0FBQ0EsYUFBQSxNQUFBLGtCQUFBO0FBQ0E7QUFBQSxNQUFBO0FBQUEsTUFDRixLQUFBO0FBRUUsZUFBQSxVQUFBLElBQUEsYUFBQTtBQUNBLGNBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQSxhQUFBLE1BQUEsa0JBQUEsUUFBQSxvQkFBQTtBQUNBLGFBQUEsTUFBQSxpQkFBQTtBQUNBO0FBQUEsTUFBQSxLQUFBO0FBRUEsZUFBQSxVQUFBLElBQUEsV0FBQTtBQUNBLGNBQUEsY0FBQSxFQUFBLE9BQUE7QUFDQSxhQUFBLE1BQUEsa0JBQUEsUUFBQSxrQkFBQTtBQUNBLGFBQUEsTUFBQSxpQkFBQTtBQUNBLG9CQUFBLGNBQUEsU0FBQSxlQUFBLEVBQUEsUUFBQTtBQUNBO0FBQUEsSUFBQTtBQUFBLEVBRU47QUFFQSxXQUFBLGdCQUFBLFFBQUEsVUFBQTtBQUNFLFVBQUEsVUFBQSxLQUFBLElBQUEsR0FBQSxLQUFBLElBQUEsR0FBQSxZQUFBLENBQUEsQ0FBQTtBQUNBLFdBQUEsTUFBQSxZQUFBLGtCQUFBLEdBQUEsVUFBQSxHQUFBLEdBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxxQkFBQSxZQUFBLEtBQUEsVUFBQTtBQUtFLFVBQUEsU0FBQSxTQUFBLGNBQUEsUUFBQTtBQUNBLFdBQUEsT0FBQTtBQUNBLFdBQUEsWUFBQTtBQUVBLFFBQUEsV0FBQSxHQUFBO0FBQ0UsYUFBQSxVQUFBLElBQUEsZ0JBQUE7QUFBQSxJQUFxQztBQUd2QyxXQUFBLGFBQUEsZUFBQSxNQUFBO0FBQ0EsV0FBQSxhQUFBLGNBQUEsR0FBQSxFQUFBLGNBQUEsQ0FBQSxJQUFBLFNBQUEsUUFBQSxFQUFBLEVBQUE7QUFDQSxXQUFBLGFBQUEsU0FBQSxFQUFBLFlBQUEsQ0FBQTtBQUdBLFFBQUE7QUFDRSxVQUFBLElBQUEsUUFBQSxRQUFBLFNBQUE7QUFDQSxVQUFBLFVBQUEsS0FBQSxRQUFBLFFBQUEsVUFBQSxTQUFBO0FBQ0EsVUFBQSxVQUFBLElBQUEsUUFBQSxRQUFBLFNBQUEsU0FBQTtBQUFBLElBQTZELFFBQUE7QUFBQSxJQUN2RDtBQUVSLFVBQUEsY0FBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLGdCQUFBLFlBQUE7QUFDQSxVQUFBLFdBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxhQUFBLFlBQUE7QUFDQSxnQkFBQSxZQUFBLFFBQUE7QUFFQSxVQUFBLFFBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxVQUFBLFlBQUE7QUFDQSxVQUFBLGNBQUEsRUFBQSxVQUFBO0FBRUEsVUFBQSxjQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsZ0JBQUEsWUFBQTtBQUVBLFdBQUEsWUFBQSxXQUFBO0FBQ0EsV0FBQSxZQUFBLEtBQUE7QUFDQSxXQUFBLFlBQUEsV0FBQTtBQUVBLFVBQUEsZUFBQSxPQUFBLE1BQUE7QUFDRSxRQUFBLGVBQUE7QUFDQSxRQUFBLGdCQUFBO0FBQ0EsWUFBQSwwQkFBQSxRQUFBLEtBQUEsUUFBQTtBQUFBLElBQXFEO0FBR3ZELFdBQUEsaUJBQUEsU0FBQSxZQUFBO0FBQ0EsV0FBQSxpQkFBQSxZQUFBLENBQUEsTUFBQTtBQUE2QyxVQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsQ0FBQTtBQUFBLElBQWtDLENBQUE7QUFFL0UsV0FBQTtBQUFBLEVBQ0Y7QUFNQSxpQkFBQSwwQkFBQSxRQUFBLEtBQUEsVUFBQTtBQUtFLFFBQUEsQ0FBQSxJQUFBO0FBQ0EsUUFBQSxlQUFBLE1BQUEsTUFBQSxPQUFBO0FBRUEsb0JBQUEsUUFBQSxDQUFBO0FBRUEsVUFBQSxZQUFBLE9BQUEsS0FBQSxJQUFBLENBQUEsSUFBQSxnQkFBQTtBQUNBLFVBQUEsWUFBQSxLQUFBLElBQUE7QUFFQSxtQkFBQSxJQUFBLFdBQUEsRUFBQSxRQUFBLFdBQUEsVUFBQSxXQUFBO0FBRUEsbUJBQUEsUUFBQSxTQUFBO0FBRUEsVUFBQSxjQUFBLE1BQUEsd0JBQUEsV0FBQSxLQUFBLFFBQUE7QUFFQSxRQUFBLENBQUEsWUFBQSxJQUFBO0FBQ0UscUJBQUEsT0FBQSxTQUFBO0FBQ0EsWUFBQSxpQkFBQSxTQUFBO0FBQ0EsWUFBQSxlQUFBLFFBQUEsWUFBQSxXQUFBO0FBQ0E7QUFBQSxJQUFBO0FBQUEsRUFFSjtBQUVBLFdBQUEsd0JBQUEsV0FBQSxLQUFBLFVBQUE7QUFLRSxVQUFBLFdBQUEsY0FBQSxHQUFBO0FBQ0EsV0FBQSxJQUFBLFFBQUEsQ0FBQSxZQUFBO0FBQ0UsVUFBQSxPQUFBLFdBQUEsZUFBQSxDQUFBLE9BQUEsU0FBQSxhQUFBO0FBQ0UsZ0JBQUEsRUFBQSxJQUFBLE9BQUEsYUFBQSx5QkFBQSxDQUFBO0FBQ0E7QUFBQSxNQUFBO0FBRUYsVUFBQTtBQUNFLGVBQUEsUUFBQTtBQUFBLFVBQWUsRUFBQSxNQUFBLGdCQUFBLEtBQUEsVUFBQSxXQUFBLFNBQUE7QUFBQSxVQUM4QyxDQUFBLGFBQUE7QUFFekQsZ0JBQUEsT0FBQSxRQUFBLGFBQUEsQ0FBQSxZQUFBLFNBQUEsWUFBQSxPQUFBO0FBQ0Usc0JBQUEsRUFBQSxJQUFBLE9BQUEsYUFBQSxVQUFBLGVBQUEsb0JBQUE7QUFBQSxZQUErRSxPQUFBO0FBRS9FLHNCQUFBLEVBQUEsSUFBQSxNQUFBO0FBQUEsWUFBb0I7QUFBQSxVQUN0QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLFFBQUE7QUFFQSxnQkFBQSxFQUFBLElBQUEsT0FBQSxhQUFBLGNBQUEsQ0FBQTtBQUFBLE1BQWlEO0FBQUEsSUFDbkQsQ0FBQTtBQUFBLEVBRUo7QUFNQSxpQkFBQSxlQUFBLFFBQUEsYUFBQTtBQUNFLG1CQUFBLFFBQUEsU0FBQSxFQUFBLFlBQUEsQ0FBQTtBQUNBLFVBQUEsZ0JBQUEsS0FBQSxJQUFBLElBQUE7QUFDQSxXQUFBLE1BQUE7QUFDRSxZQUFBLE1BQUEsR0FBQTtBQUNBLFVBQUEsZUFBQSxNQUFBLE1BQUEsUUFBQTtBQUNBLFVBQUEsS0FBQSxJQUFBLElBQUEsY0FBQTtBQUNBLFVBQUEsQ0FBQSxPQUFBLFFBQUEsUUFBQSxHQUFBO0FBQ0UsdUJBQUEsUUFBQSxNQUFBO0FBQ0Esd0JBQUEsUUFBQSxDQUFBO0FBQ0E7QUFBQSxNQUFBO0FBQUEsSUFDRjtBQUFBLEVBRUo7QUFFQSxpQkFBQSxpQkFBQSxXQUFBO0FBQ0UsVUFBQSxVQUFBLEtBQUEsSUFBQSxJQUFBO0FBQ0EsUUFBQSxVQUFBLGVBQUEsT0FBQSxNQUFBLGlCQUFBLE9BQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxNQUFBLElBQUE7QUFDRSxXQUFBLElBQUEsUUFBQSxDQUFBLFlBQUEsT0FBQSxXQUFBLFNBQUEsRUFBQSxDQUFBO0FBQUEsRUFDRjtBQU1BLE1BQUEsT0FBQSxXQUFBLGVBQUEsT0FBQSxTQUFBLFdBQUE7QUFDRSxXQUFBLFFBQUEsVUFBQSxZQUFBLENBQUEsWUFBQTtBQUNFLFVBQUEsQ0FBQSxXQUFBLFFBQUEsU0FBQSxzQkFBQTtBQUVBLFlBQUEsWUFBQSxRQUFBO0FBQ0EsVUFBQSxDQUFBLFVBQUE7QUFFQSxZQUFBLFVBQUEsZUFBQSxJQUFBLFNBQUE7QUFDQSxVQUFBLENBQUEsUUFBQTtBQUVBLFlBQUEsRUFBQSxRQUFBLFVBQUEsSUFBQTtBQUVBLE9BQUEsWUFBQTtBQUNFLGNBQUEsaUJBQUEsU0FBQTtBQUVBLGNBQUEsU0FBQSxRQUFBO0FBQ0EsY0FBQSxZQUFBLFFBQUE7QUFDQSxjQUFBLGNBQUEsUUFBQTtBQUVBLFlBQUEsV0FBQSxVQUFBO0FBQ0UseUJBQUEsUUFBQSxVQUFBLEVBQUEsWUFBQSxDQUFBO0FBQ0E7QUFBQSxRQUFBO0FBSUYsWUFBQSxXQUFBLGFBQUEsV0FBQSxZQUFBO0FBQ0UseUJBQUEsT0FBQSxTQUFBO0FBRUEsY0FBQTtBQUNFLG1CQUFBLFFBQUEsYUFBQTtBQUFBLFVBQXFDLFFBQUE7QUFBQSxVQUMvQjtBQUlSLDBCQUFBLFFBQUEsQ0FBQTtBQUNBLHlCQUFBLFFBQUEsU0FBQTtBQUdBLGdCQUFBLG9CQUFBLE1BQUE7QUFDQTtBQUFBLFFBQUE7QUFHRixZQUFBLFdBQUEsV0FBQSxXQUFBLGlCQUFBLFdBQUEsZ0JBQUE7QUFDRSxjQUFBLGNBQUEsY0FBQTtBQUNFLGtCQUFBLGVBQUEsUUFBQSxXQUFBO0FBQ0E7QUFBQSxVQUFBO0FBRUYseUJBQUEsT0FBQSxTQUFBO0FBQ0EsMEJBQUEsUUFBQSxDQUFBO0FBQ0EsZ0JBQUEsZUFBQSxRQUFBLFdBQUE7QUFBQSxRQUF3QztBQUFBLE1BQzFDLEdB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
content;