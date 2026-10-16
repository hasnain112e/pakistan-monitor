import { Panel } from './Panel';
import { safeHtml } from '@/utils/sanitize';
import {
  buildObsidianGraph,
  generateObsidianVaultMarkdown,
  type ObsidianGraphData,
  type ObsidianNode,
} from '@/services/pk-obsidian-graph';
import type { NewsItem } from '@/types';

export class PakistanObsidianGraphPanel extends Panel {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private graph: ObsidianGraphData = { nodes: [], links: [] };
  private animId: number | null = null;

  // Camera & Interaction
  private scale = 1.0;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;
  private draggedNode: ObsidianNode | null = null;
  private hoveredNode: ObsidianNode | null = null;
  private selectedNode: ObsidianNode | null = null;

  constructor(
    private readonly getNews: () => NewsItem[],
    private readonly focusMap: (lat: number, lon: number) => void,
  ) {
    super({
      id: 'pk-graph',
      title: 'Obsidian Intel Graph',
      infoTooltip:
        'Interactive force-directed entity network connecting Pakistan provinces, districts, topics and live incidents. Drag nodes, click to fly on map, or export as an Obsidian Markdown Vault.',
    });

    this.renderContainer();
    this.refreshGraph();
  }

  private renderContainer(): void {
    this.setSafeContent(safeHtml`
      <div class="pk-obsidian-wrap">
        <div class="pk-obsidian-toolbar">
          <div class="pk-obsidian-tags">
            <span class="obsidian-tag" data-filter="all">#all</span>
            <span class="obsidian-tag" data-filter="security">#security</span>
            <span class="obsidian-tag" data-filter="province">#provinces</span>
          </div>
          <button type="button" class="pk-vault-export-btn" id="pkVaultExportBtn">
            ⤓ Export Vault (.md)
          </button>
        </div>
        <div class="pk-canvas-container">
          <canvas class="pk-obsidian-canvas"></canvas>
        </div>
        <div class="pk-obsidian-inspector" id="pkObsidianInspector">
          <div class="obsidian-callout callout-info">
            <div class="callout-title"><b>Obsidian Knowledge Graph</b></div>
            <div class="callout-body">Drag nodes to explore entity relationships. Click a node to focus on map.</div>
          </div>
        </div>
      </div>
    `);

    // Wire up canvas
    this.canvas = this.content.querySelector<HTMLCanvasElement>('.pk-obsidian-canvas');
    if (this.canvas) {
      this.ctx2d = this.canvas.getContext('2d');
      this.setupCanvasEvents();
      this.resizeCanvas();
    }

    // Export vault listener
    const exportBtn = this.content.querySelector<HTMLButtonElement>('#pkVaultExportBtn');
    exportBtn?.addEventListener('click', () => this.handleVaultExport());

    // Tag filter clicks
    this.content.querySelectorAll<HTMLElement>('.obsidian-tag').forEach((el) => {
      el.addEventListener('click', () => {
        this.content.querySelectorAll('.obsidian-tag').forEach((t) => t.classList.remove('active'));
        el.classList.add('active');
        this.refreshGraph();
      });
    });

    this.startSimulation();
  }

  private handleVaultExport(): void {
    const md = generateObsidianVaultMarkdown({
      items: this.getNews(),
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pakistan-Monitor-Obsidian-Vault-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private refreshGraph(): void {
    const items = this.getNews();
    this.graph = buildObsidianGraph(items);
    this.setCount(this.graph.nodes.length);

    // Initial positioning
    const w = this.canvas?.clientWidth ?? 350;
    const h = this.canvas?.clientHeight ?? 250;
    for (const node of this.graph.nodes) {
      if (node.x == null) {
        node.x = w / 2 + (Math.random() - 0.5) * (w * 0.7);
        node.y = h / 2 + (Math.random() - 0.5) * (h * 0.7);
        node.vx = 0;
        node.vy = 0;
      }
    }
  }

  private setupCanvasEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getCanvasPoint(e);
      const clicked = this.findNodeAt(pos.x, pos.y);
      if (clicked) {
        this.draggedNode = clicked;
        this.selectedNode = clicked;
        this.inspectNode(clicked);
      } else {
        this.isPanning = true;
        this.startPanX = e.clientX - this.panX;
        this.startPanY = e.clientY - this.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.canvas) return;
      if (this.draggedNode) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
        const mouseY = (e.clientY - rect.top - this.panY) / this.scale;
        this.draggedNode.x = mouseX;
        this.draggedNode.y = mouseY;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
      } else if (this.isPanning) {
        this.panX = e.clientX - this.startPanX;
        this.panY = e.clientY - this.startPanY;
      } else {
        const pos = this.getCanvasPoint(e);
        this.hoveredNode = this.findNodeAt(pos.x, pos.y);
        this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'grab';
      }
    });

    window.addEventListener('mouseup', () => {
      this.draggedNode = null;
      this.isPanning = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.scale = Math.min(Math.max(this.scale * zoomFactor, 0.4), 2.5);
    });

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private getCanvasPoint(e: MouseEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.panX) / this.scale,
      y: (e.clientY - rect.top - this.panY) / this.scale,
    };
  }

  private findNodeAt(x: number, y: number): ObsidianNode | null {
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const n = this.graph.nodes[i];
      if (n?.x == null || n.y == null) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      const radius = n.val + 4;
      if (dx * dx + dy * dy <= radius * radius) {
        return n;
      }
    }
    return null;
  }

  private inspectNode(node: ObsidianNode): void {
    const el = this.content.querySelector<HTMLElement>('#pkObsidianInspector');
    if (!el) return;

    if (node.lat != null && node.lon != null) {
      this.focusMap(node.lat, node.lon);
    }

    const typeTag = `#${node.type}`;
    const provTag = node.province ? ` · [[${node.province}]]` : '';

    el.innerHTML = `
      <div class="obsidian-callout callout-critical">
        <div class="callout-title">
          <span class="callout-icon">◆</span>
          <b>${node.label}</b>
          <span class="obsidian-tag">${typeTag}</span>
          ${node.lat ? `<button type="button" class="pk-map-btn" style="margin-left:auto;">Fly to map</button>` : ''}
        </div>
        <div class="callout-body">
          Linked entities: ${node.linkCount ?? 0} connections${provTag}
        </div>
      </div>
    `;

    el.querySelector('.pk-map-btn')?.addEventListener('click', () => {
      if (node.lat != null && node.lon != null) this.focusMap(node.lat, node.lon);
    });
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = Math.max(parent.clientHeight, 220);
    }
  }

  private startSimulation(): void {
    const step = () => {
      this.updatePhysics();
      this.draw();
      this.animId = requestAnimationFrame(step);
    };
    this.animId = requestAnimationFrame(step);
  }

  private updatePhysics(): void {
    const { nodes, links } = this.graph;
    if (!nodes.length) return;

    const w = this.canvas?.clientWidth ?? 350;
    const h = this.canvas?.clientHeight ?? 250;
    const cx = w / 2;
    const cy = h / 2;

    // Node-Node repulsion
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      if (!n1 || n1.x == null || n1.y == null) continue;

      // Center gravity
      n1.vx = (n1.vx ?? 0) + (cx - n1.x) * 0.0006;
      n1.vy = (n1.vy ?? 0) + (cy - n1.y) * 0.0006;

      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        if (!n2 || n2.x == null || n2.y == null) continue;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy || 1;
        if (distSq < 15000) {
          const force = 35 / distSq;
          const fx = dx * force;
          const fy = dy * force;
          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx = (n2.vx ?? 0) + fx;
          n2.vy = (n2.vy ?? 0) + fy;
        }
      }
    }

    // Link spring attraction
    const nodeMap = new Map<string, ObsidianNode>(nodes.map((n) => [n.id, n]));
    for (const link of links) {
      const s = nodeMap.get(link.source);
      const t = nodeMap.get(link.target);
      if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 60;
      const force = (dist - targetDist) * 0.003 * (link.strength ?? 1);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx = (s.vx ?? 0) + fx;
      s.vy = (s.vy ?? 0) + fy;
      t.vx = (t.vx ?? 0) - fx;
      t.vy = (t.vy ?? 0) - fy;
    }

    // Velocity integration & damping
    for (const n of nodes) {
      if (n === this.draggedNode) continue;
      n.x = (n.x ?? cx) + (n.vx ?? 0);
      n.y = (n.y ?? cy) + (n.vy ?? 0);
      n.vx = (n.vx ?? 0) * 0.88;
      n.vy = (n.vy ?? 0) * 0.88;
    }
  }

  private draw(): void {
    const ctx = this.ctx2d;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    const { nodes, links } = this.graph;
    const nodeMap = new Map<string, ObsidianNode>(nodes.map((n) => [n.id, n]));

    // Draw links
    ctx.lineWidth = 1;
    for (const link of links) {
      const s = nodeMap.get(link.source);
      const t = nodeMap.get(link.target);
      if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;

      const isConnectedToHover = this.hoveredNode && (s === this.hoveredNode || t === this.hoveredNode);
      ctx.strokeStyle = isConnectedToHover ? 'rgba(47, 191, 113, 0.7)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = isConnectedToHover ? 1.5 : 0.8;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const isHover = n === this.hoveredNode;
      const isSelected = n === this.selectedNode;
      const radius = n.val;

      // Outer glow
      if (isHover || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(47, 191, 113, 0.25)';
        ctx.fill();
      }

      // Core node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Node label
      ctx.font = n.type === 'province' ? 'bold 11px Outfit, sans-serif' : '10px JetBrains Mono, monospace';
      ctx.fillStyle = isHover || isSelected ? '#ffffff' : 'rgba(240, 240, 240, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y + radius + 11);
    }

    ctx.restore();
  }

  public override destroy(): void {
    if (this.animId != null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    super.destroy();
  }
}

export default PakistanObsidianGraphPanel;
