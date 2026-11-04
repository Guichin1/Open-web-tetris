const CHANGELOG_URL = new URL('./CHANGELOG.MD', import.meta.url);

export async function loadChangelog() {
  const container = document.getElementById('changelog-content');

  try {
    const response = await fetch(CHANGELOG_URL);
    if (!response.ok) {
      throw new Error(`Changelog request failed with status ${response.status}.`);
    }

    renderChangelog(await response.text(), container);
  } catch (error) {
    console.error('Could not load CHANGELOG.MD.', error);
    container.textContent = 'Changelog unavailable. Run the game from a local web server.';
  }
}

function renderChangelog(markdown, container) {
  const sections = [...markdown.matchAll(/^#\s+(.+)$/gm)];
  container.replaceChildren();

  if (sections.length === 0) {
    container.textContent = 'No changelog entries found.';
    return;
  }

  sections.forEach((section, index) => {
    const start = section.index + section[0].length;
    const end = sections[index + 1]?.index ?? markdown.length;
    const lines = markdown.slice(start, end)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const entry = document.createElement('section');
    entry.className = 'changelog-version';
    const heading = document.createElement('h3');
    heading.textContent = section[1].trim();
    entry.appendChild(heading);

    const list = document.createElement('ul');
    lines.forEach((line) => {
      const item = document.createElement('li');
      item.textContent = line.replace(/^[-*]\s*/, '');
      list.appendChild(item);
    });
    entry.appendChild(list);
    container.appendChild(entry);
  });
}
