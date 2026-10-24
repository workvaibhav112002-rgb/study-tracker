import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders the supported subset', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** and *em* and `code`.\n\n- a\n- b\n\n1. one\n2. two\n\n```\nx < y\n```\n[Go](https://go.dev)')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>')
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>')
    expect(html).toContain('<pre><code>x &lt; y</code></pre>')
    expect(html).toContain('<a href="https://go.dev" target="_blank" rel="noopener noreferrer">Go</a>')
  })
  it('never emits raw HTML or javascript links', () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) <img onerror=1>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript')
    expect(html).toContain('&lt;script&gt;')
  })
})
