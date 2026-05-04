<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Stop Downloading One File at a Time — Classroom Quick Downloader</title>
<style>
  :root { color-scheme: light only; }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  html {
    font-size: 16px;
    scroll-behavior: smooth;
  }
  
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background-color: #F0F4F0 !important;
    color: #111111;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  /* Desktop: Base styles (600px content width) */
  .outer-wrapper {
    background-color: #F0F4F0 !important;
    padding: 0 20px;
    width: 100%;
  }
  
  .email-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    background: white;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  img {
    max-width: 100%;
    height: auto;
    display: block;
  }
  
  a {
    color: inherit;
    text-decoration: none;
  }
  
  /* Tablet: 768px and below */
  @media screen and (max-width: 768px) {
    body {
      padding: 0;
    }
    
    .outer-wrapper {
      padding: 0 12px;
    }
    
    /* Reduce section padding */
    td[style*="padding:48px 40px"] {
      padding: 32px 24px !important;
    }
    
    td[style*="padding:32px 40px"] {
      padding: 24px 20px !important;
    }
    
    td[style*="padding:20px 40px"] {
      padding: 16px 20px !important;
    }
    
    td[style*="padding:24px 40px"] {
      padding: 16px 20px !important;
    }
    
    td[style*="padding:0 40px"] {
      padding: 0 20px !important;
    }
    
    /* Reduce font sizes */
    h1 {
      font-size: 32px !important;
    }
    
    h2 {
      font-size: 24px !important;
    }
    
    p[style*="font-size:17px"] {
      font-size: 15px !important;
    }
    
    p[style*="font-size:16px"] {
      font-size: 14px !important;
    }
    
    p[style*="font-size:30px"] {
      font-size: 24px !important;
    }
    
    /* Stats grid - reduce to 2 columns */
    td[width="25%"] {
      width: 50% !important;
      border-right: none !important;
    }
    
    td[width="25%"]:nth-child(even) {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
    
    td[width="25%"]:last-child {
      border-right: none !important;
    }
    
    /* Comparison cards - stack vertically */
    td[width="48%"] {
      width: 100% !important;
      padding-right: 0 !important;
      padding-left: 0 !important;
      margin-bottom: 12px;
    }
    
    td[width="4%"] {
      display: none;
    }
    
    /* Flag images - stack */
    td[width="49%"] {
      width: 100% !important;
      padding-right: 0 !important;
      padding-left: 0 !important;
      margin-bottom: 16px;
    }
    
    td[width="2%"] {
      display: none;
    }
    
    /* Button grid - stack */
    td[align="center"][style*="padding:0 5px"] {
      display: block !important;
      width: 100% !important;
      padding: 6px 0 !important;
    }
    
    /* Feature/Step items - adjust spacing */
    td[width="40"][style*="padding-right:16px"] {
      width: 100% !important;
      padding: 0 !important;
      margin-bottom: 12px;
    }
  }
  
  /* Small tablet/Mobile: 480px and below */
  @media screen and (max-width: 480px) {
    html {
      font-size: 14px;
    }
    
    .outer-wrapper {
      padding: 0 8px;
    }
    
    /* Aggressive padding reduction */
    td[style*="padding:48px 40px"] {
      padding: 24px 16px !important;
    }
    
    td[style*="padding:32px 40px"] {
      padding: 20px 16px !important;
    }
    
    td[style*="padding:20px 40px"] {
      padding: 12px 16px !important;
    }
    
    td[style*="padding:24px 40px"] {
      padding: 12px 16px !important;
    }
    
    td[style*="padding:40px"] {
      padding: 20px 16px !important;
    }
    
    td[style*="padding:0 40px"] {
      padding: 0 16px !important;
    }
    
    /* Reduce all font sizes */
    h1[style*="font-size:42px"] {
      font-size: 28px !important;
    }
    
    h2[style*="font-size:28px"] {
      font-size: 20px !important;
    }
    
    h2[style*="font-size:30px"] {
      font-size: 22px !important;
    }
    
    p[style*="font-size:17px"] {
      font-size: 14px !important;
    }
    
    p[style*="font-size:16px"] {
      font-size: 13px !important;
    }
    
    p[style*="font-size:15px"] {
      font-size: 13px !important;
    }
    
    p[style*="font-size:14px"] {
      font-size: 12px !important;
    }
    
    /* Reduce badge size */
    span[style*="font-size:11px"] {
      font-size: 10px !important;
      padding: 4px 12px !important;
    }
    
    /* Button heights */
    td[style*="height:44px"] {
      height: 40px !important;
    }
    
    td[style*="height:52px"] {
      height: 48px !important;
    }
    
    /* Reduce icon sizes */
    div[style*="width:36px"] {
      width: 28px !important;
      height: 28px !important;
      font-size: 16px !important;
    }
    
    div[style*="width:32px"] {
      width: 28px !important;
      height: 28px !important;
      font-size: 12px !important;
    }
    
    /* Logo image */
    img[width="72"] {
      width: 56px !important;
      height: 56px !important;
    }
    
    /* Reduce margins */
    img[style*="margin:0 auto 24px"] {
      margin: 0 auto 16px !important;
    }
    
    /* Stack all buttons */
    table[style*="display:inline-table"] {
      display: block !important;
      width: 100% !important;
    }
    
    table[style*="display:inline-table"] tr {
      display: block !important;
      width: 100% !important;
    }
    
    table[style*="display:inline-table"] td {
      display: block !important;
      width: 100% !important;
      padding: 4px 0 !important;
    }
    
    /* Nested button tables */
    td[style*="padding:0 6px"] table {
      width: 100% !important;
    }
    
    td[style*="padding:0 6px"] td {
      width: 100% !important;
      padding: 0 !important;
    }
  }
  
  /* Extra small: 320px and below */
  @media screen and (max-width: 320px) {
    .outer-wrapper {
      padding: 0 4px;
    }
    
    td[style*="padding:48px 40px"] {
      padding: 16px 12px !important;
    }
    
    td[style*="padding:32px 40px"] {
      padding: 16px 12px !important;
    }
    
    td[style*="padding:20px 40px"] {
      padding: 8px 12px !important;
    }
    
    td[style*="padding:24px 40px"] {
      padding: 8px 12px !important;
    }
    
    h1[style*="font-size:42px"] {
      font-size: 24px !important;
    }
    
    h2[style*="font-size:28px"] {
      font-size: 18px !important;
    }
    
    h2[style*="font-size:30px"] {
      font-size: 20px !important;
    }
    
    p[style*="font-size:17px"] {
      font-size: 13px !important;
    }
    
    img[width="72"] {
      width: 48px !important;
      height: 48px !important;
    }
  }
  
  /* Ensure proper spacing in nested tables */
  @media screen and (max-width: 768px) {
    /* Feature/Step content area */
    td[style*="padding-right:16px"] + td {
      padding-right: 0 !important;
    }
  }
</style>
</head>
<body>

<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F0F4F0;">One click. Every file. Stop wasting time on Google Classroom.</div>

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="outer-wrapper" style="background-color:#F0F4F0 !important;padding:0 20px;">
<tr>
<td align="center">

<!-- Email container -->
<table width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width:600px;width:100%;">

  <!-- HERO -->
  <tr>
    <td bgcolor="#1B2E1C" style="background-color:#1B2E1C !important;border-radius:16px 16px 0 0;padding:0;overflow:hidden;" data-ogsc="#1B2E1C">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:20px 40px 0;text-align:center;">
            <span style="display:inline-block;background-color:#FFC107 !important;color:#1B2E1C !important;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:50px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" data-ogsc="#FFC107">Free Browser Extension</span>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 16px;text-align:center;">
            <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Logo/Classroom%20Quick%20Downloader%20-%20128.png"
                 alt="Classroom Quick Downloader" width="72" height="72"
                 style="display:block;margin:0 auto 24px;border-radius:16px;">
            <h1 style="margin:0 0 12px;font-size:42px;font-weight:400;line-height:1.1;color:#FFFFFF !important;font-family:Georgia,'Times New Roman',serif;letter-spacing:-1px;">
              Stop downloading<br>
              <em style="color:#FFC107 !important;font-style:italic;">one file at a time.</em>
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 16px;text-align:center;">
            <p style="margin:0;font-size:17px;color:#AAAAAA !important;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              Your professor just posted 12 files. You're not clicking through each one.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 40px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 auto;">
              <tr>
                <td style="padding:0 6px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#FFC107" style="background-color:#FFC107 !important;border-radius:8px;height:44px;padding:0 28px;text-align:center;vertical-align:middle;" data-ogsc="#FFC107">
                        <a href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid"
                           style="display:block;color:#1B2E1C !important;text-decoration:none;font-size:15px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.3px;line-height:44px;">
                           <span style="color:#1B2E1C !important;text-decoration:none;">Install for Chrome →</span>
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding:0 6px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#388E3C" style="background-color:#388E3C !important;border-radius:8px;height:44px;padding:0 28px;text-align:center;vertical-align:middle;" data-ogsc="#388E3C">
                        <a href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/"
                           style="display:block;color:#FFFFFF !important;text-decoration:none;font-size:15px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:44px;">
                           <span style="color:#FFFFFF !important;text-decoration:none;">Visit Website</span>
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#777777 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              Free forever · No account · No tracking
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- THE PROBLEM -->
  <tr>
    <td bgcolor="#FFFFFF" style="background-color:#FFFFFF !important;padding:48px 40px 40px;" data-ogsc="#FFFFFF">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#388E3C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">The Problem</p>
      <h2 style="margin:0 0 20px;font-size:28px;font-weight:400;color:#111111 !important;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
        Google Classroom makes<br>downloading a chore.
      </h2>
      <p style="margin:0;font-size:16px;color:#555555 !important;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Click the file. Wait. Click download. Wait. Go back. Repeat — 12 more times. By then, you've spent 4 minutes just <em>getting</em> your materials, not actually studying them.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
        <tr><td style="height:1px;background-color:#E8EEE8 !important;"></td></tr>
      </table>

      <!-- Before/After — FAKE BORDER TECHNIQUE -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="48%" valign="top" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td bgcolor="#FFDDDD" style="background-color:#FFDDDD !important;border-radius:12px;padding:2px;" data-ogsc="#FFDDDD">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#FFF5F5" style="background-color:#FFF5F5 !important;border-radius:10px;padding:20px;text-align:center;" data-ogsc="#FFF5F5">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#CC4444 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Without CQD</p>
                        <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/problem%202.png"
                             alt="Without extension" width="100%"
                             style="display:block;border-radius:8px;max-width:220px;margin:0 auto;">
                        <p style="margin:12px 0 0;font-size:13px;color:#999999 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Click. Wait. Repeat.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
          <td width="4%" valign="middle" style="text-align:center;">
            <span style="font-size:20px;color:#388E3C !important;">→</span>
          </td>
          <td width="48%" valign="top" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td bgcolor="#388E3C" style="background-color:#388E3C !important;border-radius:12px;padding:2px;" data-ogsc="#388E3C">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#F0F7F0" style="background-color:#F0F7F0 !important;border-radius:10px;padding:20px;text-align:center;" data-ogsc="#F0F7F0">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#388E3C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">With CQD</p>
                        <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/solution%202.png"
                             alt="With extension" width="100%"
                             style="display:block;border-radius:8px;max-width:220px;margin:0 auto;">
                        <p style="margin:12px 0 0;font-size:13px;color:#388E3C !important;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">One click. Done.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- STATS BAR -->
  <tr>
    <td bgcolor="#388E3C" style="background-color:#388E3C !important;padding:32px 40px;" data-ogsc="#388E3C">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" width="25%" style="padding:0 8px;border-right:1px solid rgba(255,255,255,0.2);">
            <div style="font-size:26px;font-weight:700;color:#FFC107 !important;font-family:Georgia,'Times New Roman',serif;">1K+</div>
            <div style="font-size:12px;color:#DDDDDD !important;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Installs</div>
          </td>
          <td align="center" width="25%" style="padding:0 8px;border-right:1px solid rgba(255,255,255,0.2);">
            <div style="font-size:26px;font-weight:700;color:#FFC107 !important;font-family:Georgia,'Times New Roman',serif;">95</div>
            <div style="font-size:12px;color:#DDDDDD !important;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Countries</div>
          </td>
          <td align="center" width="25%" style="padding:0 8px;border-right:1px solid rgba(255,255,255,0.2);">
            <div style="font-size:26px;font-weight:700;color:#FFC107 !important;font-family:Georgia,'Times New Roman',serif;">251K+</div>
            <div style="font-size:12px;color:#DDDDDD !important;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Clicks Saved</div>
          </td>
          <td align="center" width="25%" style="padding:0 8px;">
            <div style="font-size:26px;font-weight:700;color:#FFC107 !important;font-family:Georgia,'Times New Roman',serif;">181h+</div>
            <div style="font-size:12px;color:#DDDDDD !important;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Hours Saved</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FEATURES -->
  <tr>
    <td bgcolor="#FFFFFF" style="background-color:#FFFFFF !important;padding:48px 40px;" data-ogsc="#FFFFFF">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#388E3C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">What you get</p>
      <h2 style="margin:0 0 32px;font-size:28px;font-weight:400;color:#111111 !important;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
        Built different. By a student<br>who was tired of clicking.
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#F8FAF8" style="background-color:#F8FAF8 !important;border-radius:12px;padding:20px;" data-ogsc="#F8FAF8">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="40" valign="top" style="padding-right:16px;">
                        <div style="width:36px;height:36px;background-color:#388E3C !important;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">⚡</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111111 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Batch Download</p>
                        <p style="margin:0;font-size:14px;color:#666666 !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">One click downloads every file from the assignment — no loops, no waits.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#F8FAF8" style="background-color:#F8FAF8 !important;border-radius:12px;padding:20px;" data-ogsc="#F8FAF8">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="40" valign="top" style="padding-right:16px;">
                        <div style="width:36px;height:36px;background-color:#388E3C !important;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">🚩</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111111 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Visual Flags</p>
                        <p style="margin:0;font-size:14px;color:#666666 !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Instantly see which posts were edited or have new comments — never miss an update.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#F8FAF8" style="background-color:#F8FAF8 !important;border-radius:12px;padding:20px;" data-ogsc="#F8FAF8">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="40" valign="top" style="padding-right:16px;">
                        <div style="width:36px;height:36px;background-color:#388E3C !important;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">🔒</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111111 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Privacy First</p>
                        <p style="margin:0;font-size:14px;color:#666666 !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">No third-party tracking, no cookies, no account. Your data stays yours.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#F8FAF8" style="background-color:#F8FAF8 !important;border-radius:12px;padding:20px;" data-ogsc="#F8FAF8">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="40" valign="top" style="padding-right:16px;">
                        <div style="width:36px;height:36px;background-color:#388E3C !important;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">🌐</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111111 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Works Everywhere</p>
                        <p style="margin:0;font-size:14px;color:#666666 !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Chrome, Firefox, Edge, Brave, Opera, Vivaldi, Arc — and every Chromium browser.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HOW IT WORKS -->
  <tr>
    <td bgcolor="#1B2E1C" style="background-color:#1B2E1C !important;padding:48px 40px;" data-ogsc="#1B2E1C">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#FFC107 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">How it works</p>
      <h2 style="margin:0 0 32px;font-size:28px;font-weight:400;color:#FFFFFF !important;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
        Three steps.<br>Under ten seconds.
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" valign="top" style="padding-right:16px;">
                  <div style="width:32px;height:32px;background-color:#FFC107 !important;border-radius:50%;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#1B2E1C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">1</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#FFFFFF !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Install</p>
                  <p style="margin:0;font-size:14px;color:#AAAAAA !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Add from Chrome Web Store, Firefox Add-ons, or Edge Add-ons.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" valign="top" style="padding-right:16px;">
                  <div style="width:32px;height:32px;background-color:#FFC107 !important;border-radius:50%;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#1B2E1C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">2</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#FFFFFF !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Open Classroom</p>
                  <p style="margin:0;font-size:14px;color:#AAAAAA !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Navigate to any class. CQD detects all downloadable files automatically.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" valign="top" style="padding-right:16px;">
                  <div style="width:32px;height:32px;background-color:#FFC107 !important;border-radius:50%;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#1B2E1C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">3</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#FFFFFF !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Download Everything</p>
                  <p style="margin:0;font-size:14px;color:#AAAAAA !important;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Click once. All files land on your device simultaneously.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FLAGS SECTION -->
  <tr>
    <td bgcolor="#FFFFFF" style="background-color:#FFFFFF !important;padding:48px 40px 40px;" data-ogsc="#FFFFFF">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#388E3C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Never miss an update</p>
      <h2 style="margin:0 0 12px;font-size:28px;font-weight:400;color:#111111 !important;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
        Know when something<br>has changed.
      </h2>
      <p style="margin:0 0 28px;font-size:15px;color:#666666 !important;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        CQD adds subtle visual flags to your Classroom stream — so you can see at a glance which posts were edited or have new comments without opening each one.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="49%" style="padding-right:8px;">
            <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/edits%20flag.png"
                 alt="Edited post flag" width="100%"
                 style="display:block;border-radius:10px;border:1px solid #E8EEE8;">
            <p style="margin:8px 0 0;font-size:12px;color:#999999 !important;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Edited post indicator</p>
          </td>
          <td width="2%"></td>
          <td width="49%" style="padding-left:8px;">
            <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/comment%20flag.png"
                 alt="Comment flag" width="100%"
                 style="display:block;border-radius:10px;border:1px solid #E8EEE8;">
            <p style="margin:8px 0 0;font-size:12px;color:#999999 !important;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">New comment indicator</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- DOWNLOAD BUTTONS CLOSEUP -->
  <tr>
    <td bgcolor="#FFFFFF" style="background-color:#FFFFFF !important;padding:0 40px 40px;" data-ogsc="#FFFFFF">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#388E3C !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">The button itself</p>
      <img src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/dwonload%20buttons.png"
           alt="Download Buttons" width="100%"
           style="display:block;border-radius:10px;border:1px solid #E8EEE8;max-width:520px;margin:0 auto;">
    </td>
  </tr>

  <!-- BROWSER INSTALL -->
  <tr>
    <td bgcolor="#F8FAF8" style="background-color:#F8FAF8 !important;padding:40px;" data-ogsc="#F8FAF8">
      <p style="margin:0 0 20px;font-size:14px;color:#666666 !important;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Pick your browser — install takes 10 seconds</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding:0 5px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#388E3C" style="background-color:#388E3C !important;border-radius:8px;height:44px;padding:0 20px;text-align:center;vertical-align:middle;" data-ogsc="#388E3C">
                  <a href="https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/"
                     style="display:block;color:#FFFFFF !important;text-decoration:none;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:44px;">
                    <span style="color:#FFFFFF !important;text-decoration:none;">🦊 Firefox</span>
                  </a>
                </td>
              </tr>
            </table>
          </td>
          <td align="center" style="padding:0 5px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#FFC107" style="background-color:#FFC107 !important;border-radius:8px;height:44px;padding:0 20px;text-align:center;vertical-align:middle;" data-ogsc="#FFC107">
                  <a href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid"
                     style="display:block;color:#1B2E1C !important;text-decoration:none;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:44px;">
                    <span style="color:#1B2E1C !important;text-decoration:none;">🌐 Chrome</span>
                  </a>
                </td>
              </tr>
            </table>
          </td>
          <td align="center" style="padding:0 5px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#388E3C" style="background-color:#388E3C !important;border-radius:8px;height:44px;padding:0 20px;text-align:center;vertical-align:middle;" data-ogsc="#388E3C">
                  <a href="https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn"
                     style="display:block;color:#FFFFFF !important;text-decoration:none;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:44px;">
                    <span style="color:#FFFFFF !important;text-decoration:none;">🪟 Edge</span>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#AAAAAA !important;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Also works on Brave, Opera, Vivaldi, Arc &amp; all Chromium browsers
      </p>
    </td>
  </tr>

  <!-- FOOTER CTA -->
  <tr>
    <td bgcolor="#1B2E1C" style="background-color:#1B2E1C !important;border-radius:0 0 16px 16px;padding:48px 40px;text-align:center;" data-ogsc="#1B2E1C">
      <h2 style="margin:0 0 10px;font-size:30px;font-weight:400;color:#FFFFFF !important;font-family:Georgia,'Times New Roman',serif;">
        Ready to save hours?
      </h2>
      <p style="margin:0 0 28px;font-size:15px;color:#AAAAAA !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Free, forever. No account required.
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td bgcolor="#FFC107" style="background-color:#FFC107 !important;border-radius:8px;height:52px;padding:0 36px;text-align:center;vertical-align:middle;" data-ogsc="#FFC107">
            <a href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/"
               style="display:block;color:#1B2E1C !important;text-decoration:none;font-size:16px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.3px;line-height:52px;">
              <span style="color:#1B2E1C !important;text-decoration:none;">Get Classroom Quick Downloader →</span>
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:32px 0 0;font-size:11px;color:#555555 !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        v1.5.5 · Not affiliated with Google or Google Classroom · Built by <span style="color:#FFC107 !important;">Adham Haitham Eid</span>
      </p>
    </td>
  </tr>

  <!-- BOTTOM PADDING -->
  <tr>
    <td style="padding:24px 0;text-align:center;">
    </td>
  </tr>

</table>
</td>
</tr>
</table>

</body>
</html>
