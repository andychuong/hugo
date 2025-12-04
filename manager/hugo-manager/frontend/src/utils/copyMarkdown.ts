import { ClipboardSetText } from '../../wailsjs/runtime/runtime';

/**
 * Converts a file path to Hugo-compatible markdown path
 * Hugo serves static files from the root, so paths should start with /
 * Files in static/ directory are served from root
 * @param filePath - Relative path to the file (e.g., "assets/image.png" or "static/image.png")
 * @returns Hugo-compatible path (e.g., "/assets/image.png")
 */
function toHugoPath(filePath: string): string {
  // Remove leading ./ if present
  let path = filePath.replace(/^\.\//, '');
  
  // If path starts with 'static/', remove it (Hugo serves static/ from root)
  // So static/assets/image.png becomes /assets/image.png
  if (path.startsWith('static/')) {
    path = path.substring(7); // Remove 'static/' prefix
  }
  
  // Ensure path starts with / for absolute path from site root
  // This is how Hugo references static files
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  return path;
}

/**
 * Copies markdown image syntax to clipboard
 * @param imagePath - Path to the image file
 * @param altText - Optional alt text for the image
 * @returns Promise that resolves to true if successful
 */
export async function copyImageMarkdown(imagePath: string, altText?: string): Promise<boolean> {
  const alt = altText || imagePath.split('/').pop() || 'image';
  const hugoPath = toHugoPath(imagePath);
  const markdown = `![${alt}](${hugoPath})`;
  return await ClipboardSetText(markdown);
}

/**
 * Copies markdown link syntax to clipboard
 * @param contentPath - Path to the content file
 * @param title - Title or text for the link
 * @returns Promise that resolves to true if successful
 */
export async function copyContentMarkdown(contentPath: string, title?: string): Promise<boolean> {
  const linkText = title || contentPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || 'content';
  const markdown = `[${linkText}](${contentPath})`;
  return await ClipboardSetText(markdown);
}

