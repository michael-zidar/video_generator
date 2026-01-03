import { Client } from '@notionhq/client';

/**
 * Create a Notion client with the provided API key
 * @param {string} apiKey - Notion integration API key
 * @returns {Client}
 */
function createClient(apiKey) {
  return new Client({ auth: apiKey });
}

/**
 * Test the Notion API connection
 * @param {string} apiKey - Notion integration API key
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function testConnection(apiKey) {
  try {
    const client = createClient(apiKey);
    const response = await client.users.me();
    return {
      success: true,
      user: {
        id: response.id,
        name: response.name,
        type: response.type,
        avatar_url: response.avatar_url,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Notion',
    };
  }
}

/**
 * List all accessible pages for the integration
 * @param {string} apiKey - Notion integration API key
 * @param {string} query - Optional search query
 * @returns {Promise<Array<{id: string, title: string, icon?: string, lastEdited: string}>>}
 */
export async function listPages(apiKey, query = '') {
  const client = createClient(apiKey);
  
  const searchParams = {
    filter: { property: 'object', value: 'page' },
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
    page_size: 100,
  };
  
  if (query) {
    searchParams.query = query;
  }
  
  const response = await client.search(searchParams);
  
  return response.results.map((page) => {
    // Extract title from page properties
    let title = 'Untitled';
    if (page.properties?.title?.title?.[0]?.plain_text) {
      title = page.properties.title.title[0].plain_text;
    } else if (page.properties?.Name?.title?.[0]?.plain_text) {
      title = page.properties.Name.title[0].plain_text;
    } else {
      // Try to find any title property
      for (const prop of Object.values(page.properties || {})) {
        if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
          title = prop.title[0].plain_text;
          break;
        }
      }
    }
    
    // Extract icon
    let icon = null;
    if (page.icon?.type === 'emoji') {
      icon = page.icon.emoji;
    } else if (page.icon?.type === 'external') {
      icon = page.icon.external.url;
    }
    
    return {
      id: page.id,
      title,
      icon,
      lastEdited: page.last_edited_time,
      url: page.url,
    };
  });
}

/**
 * Get all blocks from a page recursively
 * @param {string} apiKey - Notion integration API key
 * @param {string} pageId - Page ID to fetch
 * @returns {Promise<Array>}
 */
export async function getPageBlocks(apiKey, pageId) {
  const client = createClient(apiKey);
  const blocks = [];
  let cursor = undefined;
  
  do {
    const response = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    
    for (const block of response.results) {
      blocks.push(block);
      
      // Recursively fetch children if block has them
      if (block.has_children) {
        const children = await getPageBlocks(apiKey, block.id);
        block.children = children;
      }
    }
    
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  
  return blocks;
}

/**
 * Get page metadata (title, icon, cover)
 * @param {string} apiKey - Notion integration API key
 * @param {string} pageId - Page ID
 * @returns {Promise<{title: string, icon?: string, cover?: string}>}
 */
export async function getPageMetadata(apiKey, pageId) {
  const client = createClient(apiKey);
  const page = await client.pages.retrieve({ page_id: pageId });
  
  let title = 'Untitled';
  for (const prop of Object.values(page.properties || {})) {
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      title = prop.title[0].plain_text;
      break;
    }
  }
  
  let icon = null;
  if (page.icon?.type === 'emoji') {
    icon = page.icon.emoji;
  }
  
  let cover = null;
  if (page.cover?.type === 'external') {
    cover = page.cover.external.url;
  } else if (page.cover?.type === 'file') {
    cover = page.cover.file.url;
  }
  
  return { title, icon, cover };
}

/**
 * Extract rich text content from Notion rich text array
 * @param {Array} richText - Notion rich text array
 * @returns {string}
 */
function extractRichText(richText) {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map((text) => text.plain_text || '').join('');
}

/**
 * Convert Notion blocks to Markdown format
 * @param {Array} blocks - Array of Notion blocks
 * @param {number} depth - Current nesting depth
 * @returns {string}
 */
export function blocksToMarkdown(blocks, depth = 0) {
  const lines = [];
  const indent = '  '.repeat(depth);
  
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        const paraText = extractRichText(block.paragraph?.rich_text);
        if (paraText) {
          lines.push(`${indent}${paraText}`);
          lines.push('');
        }
        break;
        
      case 'heading_1':
        const h1Text = extractRichText(block.heading_1?.rich_text);
        if (h1Text) {
          lines.push(`${indent}# ${h1Text}`);
          lines.push('');
        }
        break;
        
      case 'heading_2':
        const h2Text = extractRichText(block.heading_2?.rich_text);
        if (h2Text) {
          lines.push(`${indent}## ${h2Text}`);
          lines.push('');
        }
        break;
        
      case 'heading_3':
        const h3Text = extractRichText(block.heading_3?.rich_text);
        if (h3Text) {
          lines.push(`${indent}### ${h3Text}`);
          lines.push('');
        }
        break;
        
      case 'bulleted_list_item':
        const bulletText = extractRichText(block.bulleted_list_item?.rich_text);
        if (bulletText) {
          lines.push(`${indent}- ${bulletText}`);
        }
        break;
        
      case 'numbered_list_item':
        const numText = extractRichText(block.numbered_list_item?.rich_text);
        if (numText) {
          lines.push(`${indent}1. ${numText}`);
        }
        break;
        
      case 'to_do':
        const todoText = extractRichText(block.to_do?.rich_text);
        const checked = block.to_do?.checked ? '[x]' : '[ ]';
        if (todoText) {
          lines.push(`${indent}- ${checked} ${todoText}`);
        }
        break;
        
      case 'toggle':
        const toggleText = extractRichText(block.toggle?.rich_text);
        if (toggleText) {
          lines.push(`${indent}**${toggleText}**`);
        }
        break;
        
      case 'quote':
        const quoteText = extractRichText(block.quote?.rich_text);
        if (quoteText) {
          lines.push(`${indent}> ${quoteText}`);
          lines.push('');
        }
        break;
        
      case 'callout':
        const calloutText = extractRichText(block.callout?.rich_text);
        const calloutIcon = block.callout?.icon?.emoji || '💡';
        if (calloutText) {
          lines.push(`${indent}> ${calloutIcon} **Note:** ${calloutText}`);
          lines.push('');
        }
        break;
        
      case 'code':
        const codeText = extractRichText(block.code?.rich_text);
        const language = block.code?.language || '';
        if (codeText) {
          lines.push(`${indent}\`\`\`${language}`);
          lines.push(`${indent}${codeText}`);
          lines.push(`${indent}\`\`\``);
          lines.push('');
        }
        break;
        
      case 'divider':
        lines.push(`${indent}---`);
        lines.push('');
        break;
        
      case 'image':
        let imageUrl = '';
        if (block.image?.type === 'external') {
          imageUrl = block.image.external.url;
        } else if (block.image?.type === 'file') {
          imageUrl = block.image.file.url;
        }
        const caption = extractRichText(block.image?.caption) || 'Image';
        if (imageUrl) {
          lines.push(`${indent}![${caption}](${imageUrl})`);
          lines.push('');
        }
        break;
        
      case 'video':
        let videoUrl = '';
        if (block.video?.type === 'external') {
          videoUrl = block.video.external.url;
        } else if (block.video?.type === 'file') {
          videoUrl = block.video.file.url;
        }
        if (videoUrl) {
          lines.push(`${indent}[Video](${videoUrl})`);
          lines.push('');
        }
        break;
        
      case 'bookmark':
        const bookmarkUrl = block.bookmark?.url || '';
        const bookmarkCaption = extractRichText(block.bookmark?.caption) || bookmarkUrl;
        if (bookmarkUrl) {
          lines.push(`${indent}[${bookmarkCaption}](${bookmarkUrl})`);
          lines.push('');
        }
        break;
        
      case 'table':
        // Tables are complex, just note their presence
        lines.push(`${indent}[Table with ${block.table?.table_width || 0} columns]`);
        lines.push('');
        break;
        
      case 'column_list':
      case 'column':
        // Process children but don't add special formatting
        break;
        
      case 'child_page':
        const childTitle = block.child_page?.title || 'Subpage';
        lines.push(`${indent}📄 **${childTitle}** (subpage)`);
        lines.push('');
        break;
        
      case 'child_database':
        const dbTitle = block.child_database?.title || 'Database';
        lines.push(`${indent}📊 **${dbTitle}** (database)`);
        lines.push('');
        break;
        
      default:
        // Unknown block type, skip
        break;
    }
    
    // Process children if they exist
    if (block.children && block.children.length > 0) {
      const childContent = blocksToMarkdown(block.children, depth + 1);
      if (childContent) {
        lines.push(childContent);
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Get full page content as markdown
 * @param {string} apiKey - Notion integration API key
 * @param {string} pageId - Page ID to fetch
 * @returns {Promise<{title: string, markdown: string, metadata: object}>}
 */
export async function getPageContent(apiKey, pageId) {
  const [metadata, blocks] = await Promise.all([
    getPageMetadata(apiKey, pageId),
    getPageBlocks(apiKey, pageId),
  ]);
  
  const markdown = blocksToMarkdown(blocks);
  
  return {
    title: metadata.title,
    markdown: `# ${metadata.title}\n\n${markdown}`,
    metadata,
    blockCount: blocks.length,
  };
}

