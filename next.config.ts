@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
:root{--ink:#202336;--muted:#85899b;--line:#ececf2;--canvas:#f7f7fb;--purple:#7566cc;--mint:#56c6aa;--navy:#25283a;--green:#199877;--red:#d56776;--amber:#cf9551}*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:'DM Sans',sans-serif;color:var(--ink);background:var(--canvas);font-size:13px}button,input,select,textarea{font:inherit}button{cursor:pointer;color:inherit}.shell{min-height:100vh;display:flex}.sidebar{width:248px;background:#fff;border-right:1px solid #ececf1;display:flex;flex-direction:column;flex-shrink:0;padding:0 14px;position:fixed;inset:0 auto 0 0;z-index:10}.brand{height:72px;display:flex;align-items:center;gap:10px;padding:0 8px;border-bottom:1px solid #f0f0f4}.brand-mark{width:30px;height:30px;background:#29283c;border-radius:9px;color:#fff;display:grid;place-items:center;font:800 18px Manrope;position:relative;overflow:hidden}.brand-mark:after{content:'';position:absolute;width:20px;height:3px;background:#9b8be8;transform:rotate(-46deg);top:14px;left:10px}.brand-mark span{z-index:1}.brand b{font:800 12px Manrope;letter-spacing:1.55px;display:block}.brand small{font:700 8px Manrope;letter-spacing:2.7px;color:#858495;display:block;margin-top:2px}.icon-button{border:0;background:transparent;color:#8b8fa0;display:grid;place-items:center;width:32px;height:32px;border-radius:8px;position:relative}.icon-button:hover{background:#f3f2f8;color:#5b53a8}.sidebar-collapse{margin-left:auto}.workspace-switch{display:flex;align-items:center;gap:10px;margin:15px 2px 12px;padding:9px 8px;border:1px solid #eeeeF3;border-radius:10px}.workspace-avatar,.profile-pic,.top-avatar{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;background:#ece9fb;color:#6e5dbb;font-weight:700;font-size:12px;flex-shrink:0}.workspace-label{flex:1}.workspace-label b,.profile b{font-size:11px;display:block;font-weight:700}.workspace-label small,.profile small{font-size:10px;color:var(--muted);display:block;margin-top:3px}.topic-select{width:100%;border:0;background:#f8f7fc;display:flex;align-items:center;gap:9px;padding:10px 9px;border-radius:9px;text-align:left;margin:0 0 16px}.topic-select span:nth-child(2){display:flex;flex-direction:column;flex:1;gap:4px}.topic-select small{font-size:8px;letter-spacing:.7px;color:#8f90a0;font-weight:700}.topic-select b{font-size:10px}.live-dot{width:7px;height:7px;display:inline-block;border-radius:50%;background:#59c6a8;box-shadow:0 0 0 3px #eaf7f2;flex-shrink:0}.sidebar nav{overflow:auto;flex:1}.sidebar nav section{margin-bottom:13px}.nav-group{font-size:9px;letter-spacing:1.1px;font-weight:700;color:#a3a5b2;padding:7px 9px}.nav-item{height:34px;width:100%;display:flex;align-items:center;gap:10px;padding:0 10px;border:0;background:transparent;border-radius:7px;color:#707488;text-align:left;font-size:11px;margin:2px 0}.nav-item:hover{background:#f8f7fb}.nav-item.active{background:#f0edfb;color:#6959b7;font-weight:700}.nav-item.active:before{content:'';position:absolute;left:0;width:3px;height:24px;border-radius:0 3px 3px 0;background:#7667cc}.nav-count{margin-left:auto;background:#f8e9eb;color:#c46a78;font-style:normal;border-radius:9px;padding:2px 6px;font-size:9px}.sidebar-bottom{padding:12px 0 6px;border-top:1px solid #f0f0f4}.profile{display:flex;align-items:center;gap:9px;padding:13px 6px 2px;margin-top:5px;border-top:1px solid #f0f0f4}.profile>div:nth-child(2){flex:1}.profile-pic{border-radius:50%;background:#f2e9e7;color:#986a65;font-size:10px}.profile>svg{color:#9699a7}.main-area{margin-left:248px;width:calc(100% - 248px);min-width:0}.topbar{height:58px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 31px;position:sticky;top:0;z-index:5}.crumb{display:flex;align-items:center;gap:9px;color:#9295a3;font-size:11px}.crumb b{color:#383a4c;font-weight:600}.top-actions{display:flex;align-items:center;gap:11px}.env-pill{font-size:10px;color:#797c8d;background:#f7f7fa;padding:6px 9px;border-radius:6px;display:flex;align-items:center;gap:7px}.green-pip,.sync-pip{width:6px;height:6px;border-radius:50%;background:#5dc5a5;display:inline-block}.top-avatar{width:29px;height:29px;border-radius:50%;font-size:10px}.alert-trigger>i{position:absolute;width:5px;height:5px;background:#df7982;border:1px solid #fff;border-radius:50%;right:6px;top:5px}.alerts-popover{position:absolute;right:54px;top:49px;width:280px;padding:15px;background:#fff;border:1px solid var(--line);box-shadow:0 12px 35px #252b4715;border-radius:11px;z-index:11}.alerts-popover strong{font-size:12px}.alerts-popover p{font-size:10px;border-top:1px solid #f1f1f4;margin:11px 0 0;padding:10px 0 0;position:relative;padding-left:14px}.alerts-popover p small{display:block;color:var(--muted);margin-top:4px}.alert-dot{position:absolute;left:0;top:13px;width:6px;height:6px;border-radius:50%}.alert-dot.red{background:#de7882}.alert-dot.amber{background:#dba459}.alert-dot.blue{background:#7c91d2}.alerts-popover>button{border:0;background:transparent;color:#7465c7;font-size:10px;display:flex;align-items:center;margin-top:11px;padding:0}.mobile-menu{display:none;border:0;background:none;color:#888}.content{max-width:1540px;padding:27px 31px 18px;margin:auto}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:21px;gap:16px}.eyebrow{font-size:9px;font-weight:700;letter-spacing:.8px;color:#8e91a1;display:flex;align-items:center;gap:8px}.eyebrow .live-dot{width:6px;height:6px}.eyedot{color:#c5c5cf}.page-heading h1{font:700 24px Manrope;letter-spacing:-.65px;margin:8px 0 4px;color:#25273a}.page-heading p{margin:0;color:#888c9c;font-size:11px}.wave{color:#9180da;font-size:17px;margin-left:8px}.heading-actions{display:flex;gap:8px;align-items:center}.range-select,.button-secondary,.button-primary,.mini-select{height:32px;border:1px solid #e8e8ef;bcpu: [x64]
    os: [openbsd]

  '@esbuild/openharmony-arm64@0.27.7':
    resolution: {integrity: sha512-+KrvYb/C8zA9CU/g0sR6w2RBw7IGc5J2BPnc3dYc5VJxHCSF1yNMxTV5LQ7GuKteQXZtspjFbiuW5/dOj7H4Yw==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [openharmony]

  '@esbuild/sunos-x64@0.27.7':
    resolution: {integrity: sha512-ikktIhFBzQNt/QDyOL580ti9+5mL/YZeUPKU2ivGtGjdTYoqz6jObj6nOMfhASpS4GU4Q/Clh1QtxWAvcYKamA==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [sunos]

  '@esbuild/win32-arm64@0.27.7':
    resolution: {integrity: sha512-7yRhbHvPqSpRUV7Q20VuDwbjW5kIMwTHpptuUzV+AA46kiPze5Z7qgt6CLCK3pWFrHeNfDd1VKgyP4O+ng17CA==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [win32]

  '@esbuild/win32-ia32@0.27.7':
    resolution: {integrity: sha512-SmwKXe6VHIyZYbBLJrhOoCJRB/Z1tckzmgTLfFYOfpMAx63BJEaL9ExI8x7v0oAO3Zh6D/Oi1gVxEYr5oUCFhw==}
    engines: {node: '>=18'}
    cpu: [ia32]
    os: [win32]

  '@esbuild/win32-x64@0.27.7':
    resolution: {integrity: sha512-56hiAJPhwQ1R4i+21FVF7V8kSD5zZTdHcVuRFMW0hn753vVfQN8xlx4uOPT4xoGH0Z/oVATuR82AiqSTDIpaHg==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [win32]

  '@img/colour@1.1.0':
    resolution: {integrity: sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==}
    engines: {node: '>=18'}

  '@img/sharp-darwin-arm64@0.35.5':
    resolution: {integrity: sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==}
    engines: {node: '>=20.9.0'}
    cpu: [arm64]
    os: [darwin]

  '@img/sharp-darwin-x64@0.35.5':
    resolution: {integrity: sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==}
    engines: {node: '>=20.9.0'}
    cpu: [x64]
    os: [darwin]

  '@img/sharp-freebsd-wasm32@0.35.5':
    resolution: {integrity: sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==}
    engines: {node: '>=20.9.0'}
    os: [freebsd]

  '@img/sharp-libvips-darwin-arm64@1.3.4':
    resolution: {integrity: sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==}
    cpu: [arm64]
    os: [darwin]

  '@img/sharp-libvips-darwin-x64@1.3.4':
    resolution: {integrity: sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==}
    cpu: [x64]
    os: [darwin]

  '@img/sharp-libvips-linux-arm64@1.3.4':
    resolution: {integrity: sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==}
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linux-arm@1.3.4':
    resolution: {integrity: sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==}
    cpu: [arm]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linux-ppc64@1.3.4':
    resolution: {integrity: sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==}
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linux-riscv64@1.3.4':
    resolution: {integrity: sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==}
    cpu: [riscv64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linux-s390x@1.3.4':
    resolution: {integrity: sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==}
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linux-x64@1.3.4':
    resolution: {integrity: sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==}
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-libvips-linuxmusl-arm64@1.3.4':
    resolution: {integrity: sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==}
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  '@img/sharp-libvips-linuxmusl-x64@1.3.4':
    resolution: {integrity: sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==}
    cpu: [x64]
    os: [linux]
    libc: [musl]

  '@img/sharp-linux-arm64@0.35.5':
    resolution: {integrity: sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==}
    engines: {node: '>=20.9.0'}
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linux-arm@0.35.5':
    resolution: {integrity: sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==}
    engines: {node: '>=20.9.0'}
    cpu: [arm]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linux-ppc64@0.35.5':
    resolution: {integrity: sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==}
    engines: {node: '>=20.9.0'}
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linux-riscv64@0.35.5':
    resolution: {integrity: sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==}
    engines: {node: '>=20.9.0'}
    cpu: [riscv64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linux-s390x@0.35.5':
    resolution: {integrity: sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==}
    engines: {node: '>=20.9.0'}
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linux-x64@0.35.5':
    resolution: {integrity: sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==}
    engines: {node: '>=20.9.0'}
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  '@img/sharp-linuxmusl-arm64@0.35.5':
    resolution: {integrity: sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==}
    engines: {node: '>=20.9.0'}
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  '@img/sharp-linuxmusl-x64@0.35.5':
    resolution: {integrity: sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==}
    ondary"><Download size={13}/> Export view</button></div><div className="module-grid-head"><span>{active==="Sources"?"SOURCE":active==="Influencers"?"ACCOUNT":"NAME"}</span><span>TYPE / COVERAGE</span><span>{active==="Competitors"?"SHARE OF VOICE":"METRIC"}</span><span>CHANGE / STATUS</span></div>{rows.map((r:string[])=><div className="module-data-row" key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span></div>)}</div></section>;
  return <section className="module-workspace"><div className="card module-table"><div className="module-table-head"><div><h2>{active} workspace</h2><p>Analysis is scoped to your selected topic.</p></div><Activity size={17}/></div><div className="empty-module"><Sparkles size={18}/><b>Intelligence view</b><p>Connect an authorized source to populate real signals. Synthetic sample data remains labeled in demo mode.</p><button className="button-secondary">Configure data source <ChevronRight size={13}/></button></div></div></section>;
}
