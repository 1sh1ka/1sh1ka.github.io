import { useEffect, useMemo, useRef } from 'react'
import siteHtml from '../site/index.html?raw'
import { initSite } from '../site/initSite'

/**
 * Renders the standalone /frontend/site/index.html inside the app preview.
 * Markup and styles come straight from that file; scripts are stripped and
 * replaced by the typed initSite() port because the CSP blocks inline JS.
 */
export default function KnightPreview() {
  const rootRef = useRef<HTMLDivElement>(null)

  const { markup, stylesheets } = useMemo(() => {
    const doc = new DOMParser().parseFromString(siteHtml, 'text/html')
    const css = Array.from(doc.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
    doc.querySelectorAll('script').forEach((s) => s.remove())
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => l.getAttribute('href'))
      .filter((href): href is string => Boolean(href))
    return {
      markup: { __html: `<style>${css}</style>${doc.body.innerHTML}` },
      stylesheets: links,
    }
  }, [])

  useEffect(() => {
    document.title = 'Мансур — личная хроника'
    stylesheets.forEach((href) => {
      if (document.querySelector(`link[href="${href}"]`)) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    })
    const root = rootRef.current
    if (!root) return
    return initSite(root)
  }, [stylesheets])

  return <div ref={rootRef} className="js" dangerouslySetInnerHTML={markup} />
}
