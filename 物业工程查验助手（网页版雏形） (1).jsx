import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Camera, Save, Trash2, FileDown, Upload, Search, CheckCircle2, AlertTriangle, Building2, ClipboardList, Wrench, BarChart2, Filter, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// —— 简易本地存储封装（离线可用）——
const LS_KEY = "inspection_app_v1";
function loadStore() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveStore(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// —— 预置查验模板（可在设置里扩展）——
const DEFAULT_TEMPLATES = [
  {
    id: "waterproof",
    name: "防水工程",
    items: [
      "卫生间、阳台、厨房防水施工完成且闭水试验通过",
      "墙/地面无空鼓、开裂、起砂、渗漏",
      "地漏及泛水坡度正确，无倒坡",
      "管根、阴阳角、套管处附加层完整",
      "防水层上翻高度符合规范",
    ],
  },
  {
    id: "electrical",
    name: "电气工程",
    items: [
      "配电箱固定牢靠，回路标识清晰",
      "导线规格/颜色/敷设规范，穿管无破损",
      "插座接地/接零正确，极性正确",
      "开关、插座、灯具安装牢固、位置正确",
      "弱电箱、入户信息端口标注清楚",
    ],
  },
  {
    id: "fire",
    name: "消防/安防",
    items: [
      "公共区域灭火器配置齐全、在有效期内",
      "消火栓、水泵接合器外观完好、标识清晰",
      "消防门闭门器灵活、常闭，合页无异响",
      "应急照明、疏散指示灯通电正常",
      "消防管道无渗漏，支吊架间距符合要求",
    ],
  },
  {
    id: "plumbing",
    name: "给排水/暖通",
    items: [
      "供水、回水管道无渗漏，阀门启闭灵活",
      "排水通畅，存水弯设置正确",
      "暖通风口安装牢固、风量基本达标",
      "设备基础减振、冷凝水排放顺畅",
      "水表、热量表安装方向正确、可读性好",
    ],
  },
  {
    id: "finishing",
    name: "精装/公区装饰",
    items: [
      "墙地砖空鼓率符合要求，勾缝均匀",
      "乳胶漆表面平整、无流坠、无明显色差",
      "门窗安装牢固、开启灵活、密封良好",
      "栏杆扶手牢固、缝隙间距合规",
      "吊顶造型顺直，检修口位置合理",
    ],
  },
];

// —— 工具函数 ——
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

function useStore() {
  const [store, setStore] = useState(() => {
    const s = loadStore();
    return {
      projects: s.projects || [], // {id, name, building, unit, remark}
      issues: s.issues || [], // {id, projectId, category, title, desc, severity, responsible, due, images:[], position, standardRef, status}
      templates: s.templates || DEFAULT_TEMPLATES,
    };
  });
  useEffect(() => { saveStore(store); }, [store]);
  return [store, setStore];
}

// —— 组件：图片上传为 base64 ——
function ImageUploader({ onAdd }) {
  async function handle(e) {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const b64 = await fileToBase64(f);
      onAdd(b64);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Input type="file" accept="image/*" capture="environment" multiple onChange={handle} />
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// —— 导出 JSON 备份/导入 ——
function downloadText(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = filename;
  a.click();
}

function readFileText(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsText(file);
  });
}

// —— 生成 PDF 报告 ——
async function exportProjectPDF(project, issues) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(`项目查验报告 / ${project.name}`, 40, 50);
  doc.setFontSize(11);
  doc.text(`楼栋/单元：${project.building || "-"} / ${project.unit || "-"}`, 40, 80);
  doc.text(`导出日期：${today()}`, 40, 100);

  const rows = issues.map((i, idx) => [
    idx + 1,
    i.category,
    i.title,
    i.severity,
    i.responsible || "-",
    i.due || "-",
    i.status || "待整改",
  ]);

  autoTable(doc, {
    startY: 120,
    head: [["序号", "类别", "问题概述", "严重程度", "责任单位", "计划完成", "状态"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [240, 240, 240] },
  });

  // 附件图片（每条问题首图）
  let y = (doc as any).lastAutoTable?.finalY || 140;
  y += 20;
  doc.setFontSize(13);
  doc.text("问题图片（首图预览）", 40, y);
  y += 12;

  for (const i of issues) {
    if (!i.images?.length) continue;
    const img = i.images[0];
    const maxWidth = 520;
    const imgHeight = 180;
    y += 12;
    doc.setFontSize(11);
    doc.text(`【${i.category}】${i.title}`, 40, y);
    y += 6;
    try {
      doc.addImage(img, "JPEG", 40, y + 10, maxWidth, imgHeight, undefined, "FAST");
      y += imgHeight + 20;
      if (y > 760) { doc.addPage(); y = 60; }
    } catch {}
  }

  doc.save(`${project.name}-查验报告-${today()}.pdf`);
}

// —— 生成单条问题整改单（PDF） ——
async function exportIssuePDF(project, issue) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text("工程问题整改单", 40, 50);
  doc.setFontSize(11);
  doc.text(`项目：${project.name}`, 40, 80);
  doc.text(`楼栋/单元：${project.building || "-"} / ${project.unit || "-"}`, 40, 100);
  doc.text(`问题编号：${issue.id}`, 40, 120);

  autoTable(doc, {
    startY: 140,
    body: [
      ["问题类别", issue.category],
      ["问题概述", issue.title],
      ["详细描述", issue.desc || "-"],
      ["现场位置", issue.position || "-"],
      ["规范/验收依据", issue.standardRef || "-"],
      ["严重程度", issue.severity],
      ["责任单位", issue.responsible || "-"],
      ["计划完成时间", issue.due || "-"],
      ["状态", issue.status || "待整改"],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    theme: "grid",
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 380 } },
  });

  let y = (doc as any).lastAutoTable?.finalY || 160;
  y += 20;
  doc.setFontSize(13);
  doc.text("现场照片", 40, y);
  y += 12;
  const pics = issue.images || [];
  for (const img of pics.slice(0, 3)) {
    try {
      doc.addImage(img, "JPEG", 40, y, 240, 160, undefined, "FAST");
      y += 180;
      if (y > 760) { doc.addPage(); y = 60; }
    } catch {}
  }

  doc.save(`${project.name}-整改单-${issue.id}.pdf`);
}

// —— 主应用 ——
export default function InspectionApp() {
  const [store, setStore] = useStore();
  const [activeTab, setActiveTab] = useState("dashboard");

  const projects = store.projects;
  const issues = store.issues;

  const [q, setQ] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      if (filterProject !== "all" && i.projectId !== filterProject) return false;
      if (filterStatus !== "all" && (i.status || "待整改") !== filterStatus) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      const kw = q.trim();
      if (!kw) return true;
      return [i.title, i.desc, i.category, i.responsible, i.position].some(x => (x||"").includes(kw));
    });
  }, [issues, q, filterProject, filterStatus, filterSeverity]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="w-7 h-7" /> 物业工程查验助手
            </h1>
            <p className="text-slate-500">面向中国物业工程现场的轻量级离线可用工具 · 本地存储 · 一键生成PDF报告</p>
          </div>
          <div className="flex gap-2">
            <BackupButtons store={store} setStore={setStore} />
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 md:max-w-3xl">
            <TabsTrigger value="dashboard">概览</TabsTrigger>
            <TabsTrigger value="inspect">查验</TabsTrigger>
            <TabsTrigger value="issues">整改</TabsTrigger>
            <TabsTrigger value="settings">设置</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <Dashboard projects={projects} issues={issues} setActiveTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="inspect" className="mt-6">
            <InspectPage store={store} setStore={setStore} />
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <IssuesPage store={store} setStore={setStore}
              q={q} setQ={setQ}
              filterProject={filterProject} setFilterProject={setFilterProject}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              filterSeverity={filterSeverity} setFilterSeverity={setFilterSeverity}
              filteredIssues={filteredIssues}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsPage store={store} setStore={setStore} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Dashboard({ projects, issues, setActiveTab }) {
  const total = issues.length;
  const pending = issues.filter(i => (i.status || "待整改") === "待整改").length;
  const reviewing = issues.filter(i => i.status === "待复验").length;
  const done = issues.filter(i => i.status === "已完成").length;

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <StatCard icon={<Building2 />} title="项目数量" value={projects.length} />
      <StatCard icon={<Wrench />} title="待整改" value={pending} />
      <StatCard icon={<CheckCircle2 />} title="已完成" value={done} />

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>近期问题</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {issues.slice(-6).reverse().map(i => (
            <div key={i.id} className="flex items-start justify-between border rounded-xl p-3">
              <div>
                <div className="font-medium">{i.title} <Badge variant="secondary" className="ml-2">{i.category}</Badge></div>
                <div className="text-xs text-slate-500 mt-1">严重程度：{i.severity} · 责任：{i.responsible || "-"} · 状态：{i.status || "待整改"}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("issues")}>去处理</Button>
            </div>
          ))}
          {issues.length === 0 && <div className="text-slate-500">暂无问题记录，去“查验”页开始创建吧。</div>}
        </CardContent>
      </Card>

      <QuickStart setActiveTab={setActiveTab} />
    </div>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className="opacity-60">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickStart({ setActiveTab }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>快速开始</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full" onClick={() => setActiveTab("inspect")}>新建查验记录</Button>
        <Button className="w-full" variant="outline" onClick={() => setActiveTab("issues")}>查看整改清单</Button>
      </CardContent>
    </Card>
  );
}

function InspectPage({ store, setStore }) {
  const [projectId, setProjectId] = useState(store.projects[0]?.id || "");
  const [category, setCategory] = useState(store.templates[0]?.id || "");
  const [checked, setChecked] = useState({});
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState("一般");
  const [responsible, setResponsible] = useState("");
  const [due, setDue] = useState("");
  const [position, setPosition] = useState("");
  const [standardRef, setStandardRef] = useState("");
  const [images, setImages] = useState([]);

  useEffect(() => {
    if (!projectId && store.projects[0]) setProjectId(store.projects[0].id);
    if (!category && store.templates[0]) setCategory(store.templates[0].id);
  }, [store.projects, store.templates]);

  const tpl = store.templates.find(t => t.id === category);

  function toggleItem(idx) {
    setChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function addImage(b64) { setImages(prev => [...prev, b64]); }

  function saveIssue() {
    if (!projectId) { toast.error("请先创建并选择一个项目"); return; }
    if (!title.trim()) { toast.error("请填写问题概述"); return; }
    const issue = {
      id: uid(), projectId, category: tpl?.name || category, title: title.trim(), desc: desc.trim(),
      severity, responsible, due, images, position, standardRef, status: "待整改",
      createdAt: Date.now(),
    };
    setStore(s => ({ ...s, issues: [...s.issues, issue] }));
    setTitle(""); setDesc(""); setImages([]); setPosition(""); setStandardRef(""); setSeverity("一般"); setResponsible(""); setDue("");
    toast.success("已保存到整改清单");
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>现场查验记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">选择项目</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="请选择项目" /></SelectTrigger>
                <SelectContent>
                  {store.projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">查验类别</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="请选择类别" /></SelectTrigger>
                <SelectContent>
                  {store.templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">问题概述</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：卫生间地漏附近有渗水痕迹" />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-600">严重程度</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="一般">一般</SelectItem>
                  <SelectItem value="重要">重要</SelectItem>
                  <SelectItem value="严重">严重</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-600">责任单位</label>
              <Input value={responsible} onChange={(e)=>setResponsible(e.target.value)} placeholder="例如：土建一标段/精装施工单位"/>
            </div>
            <div>
              <label className="text-sm text-slate-600">计划完成时间</label>
              <Input type="date" value={due} onChange={(e)=>setDue(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600">现场位置</label>
              <Input value={position} onChange={(e)=>setPosition(e.target.value)} placeholder="楼栋-楼层-房号/公区位置" />
            </div>
            <div>
              <label className="text-sm text-slate-600">规范/验收依据</label>
              <Input value={standardRef} onChange={(e)=>setStandardRef(e.target.value)} placeholder="例如：GB 50210、图集XX-XX" />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">现场照片</label>
            <div className="flex items-center gap-2">
              <ImageUploader onAdd={addImage} />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} alt="upload" className="w-full h-20 object-cover rounded-xl border" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-slate-600">详细描述（语音可转文字后粘贴）</label>
            <Textarea rows={4} value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="现场观察、测量数据、影响范围、建议方案等" />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveIssue}><Save className="w-4 h-4 mr-1"/> 保存到整改清单</Button>
            <CreateProjectDialog store={store} setStore={setStore} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>查验清单（{store.templates.find(t=>t.id===category)?.name || "-"}）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tpl?.items.map((it, idx) => (
            <label key={idx} className="flex items-start gap-2">
              <Checkbox checked={!!checked[idx]} onCheckedChange={()=>toggleItem(idx)} />
              <span className={"text-sm " + (checked[idx] ? "line-through text-slate-400" : "")}>{it}</span>
            </label>
          ))}
          {!tpl && <div className="text-slate-500 text-sm">请在设置中添加查验模板。</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateProjectDialog({ store, setStore }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [unit, setUnit] = useState("");
  const [remark, setRemark] = useState("");

  function create() {
    if (!name.trim()) { toast.error("请输入项目名称"); return; }
    const p = { id: uid(), name: name.trim(), building, unit, remark };
    setStore(s => ({ ...s, projects: [...s.projects, p] }));
    setName(""); setBuilding(""); setUnit(""); setRemark(""); setOpen(false);
    toast.success("项目已创建");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="w-4 h-4 mr-1"/> 新建项目</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>用于归档查验与整改记录</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="项目名称（必填）" value={name} onChange={(e)=>setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="楼栋/地块" value={building} onChange={(e)=>setBuilding(e.target.value)} />
            <Input placeholder="单元/标段" value={unit} onChange={(e)=>setUnit(e.target.value)} />
          </div>
          <Textarea rows={3} placeholder="备注（建设单位/监理/施工总包等）" value={remark} onChange={(e)=>setRemark(e.target.value)} />
          <Button onClick={create}><Save className="w-4 h-4 mr-1"/> 创建</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssuesPage({ store, setStore, q, setQ, filterProject, setFilterProject, filterStatus, setFilterStatus, filterSeverity, setFilterSeverity, filteredIssues }) {
  function setStatus(id, status) {
    setStore(s => ({ ...s, issues: s.issues.map(i => i.id===id? { ...i, status } : i) }));
  }
  function remove(id) {
    setStore(s => ({ ...s, issues: s.issues.filter(i => i.id!==id) }));
  }

  const projects = store.projects.reduce((m, p)=> (m[p.id]=p, m), {} as Record<string, any>);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-6 gap-3">
            <div className="md:col-span-2 flex items-center gap-2">
              <Search className="w-4 h-4"/>
              <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="搜索：问题/位置/责任单位/类别" />
            </div>
            <div>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger><SelectValue placeholder="项目" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {store.projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="待整改">待整改</SelectItem>
                  <SelectItem value="待复验">待复验</SelectItem>
                  <SelectItem value="已完成">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger><SelectValue placeholder="严重程度" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部程度</SelectItem>
                  <SelectItem value="一般">一般</SelectItem>
                  <SelectItem value="重要">重要</SelectItem>
                  <SelectItem value="严重">严重</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <ExportButtons store={store} filteredIssues={filteredIssues} />
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredIssues.length === 0 && (
        <Card><CardContent className="py-10 text-center text-slate-500">暂无匹配的记录</CardContent></Card>
      )}

      <div className="grid gap-3">
        {filteredIssues.map(i => (
          <Card key={i.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium flex items-center gap-2">
                    {i.title}
                    <Badge variant="secondary">{i.category}</Badge>
                    <Badge>{i.severity}</Badge>
                    <Badge variant={i.status === "已完成"? "default" : i.status === "待复验"? "outline" : "destructive"}>{i.status || "待整改"}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">项目：{projects[i.projectId]?.name || "-"} · 位置：{i.position || "-"} · 责任：{i.responsible || "-"} · 完成：{i.due || "-"}</div>
                  {i.desc && <div className="text-sm mt-2 whitespace-pre-wrap">{i.desc}</div>}
                  {i.images?.length>0 && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                      {i.images.map((img, idx) => (
                        <img key={idx} src={img} className="w-full h-20 object-cover rounded-xl border" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-[180px]">
                  <Select value={i.status || "待整改"} onValueChange={(v)=>setStatus(i.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="待整改">待整改</SelectItem>
                      <SelectItem value="待复验">待复验</SelectItem>
                      <SelectItem value="已完成">已完成</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={()=>{
                      const project = projects[i.projectId];
                      exportIssuePDF(project, i);
                    }}>
                      <FileText className="w-4 h-4 mr-1"/> 整改单
                    </Button>
                    <Button variant="destructive" onClick={()=>remove(i.id)}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExportButtons({ store, filteredIssues }) {
  function exportCSV() {
    const headers = ["项目","类别","问题概述","严重程度","责任单位","计划完成","状态","位置","规范依据","创建时间","图片数量"]; 
    const rows = filteredIssues.map(i => {
      const p = store.projects.find(p=>p.id===i.projectId);
      return [
        p?.name || "",
        i.category,
        i.title,
        i.severity,
        i.responsible || "",
        i.due || "",
        i.status || "待整改",
        i.position || "",
        i.standardRef || "",
        new Date(i.createdAt||Date.now()).toLocaleString(),
        i.images?.length || 0,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    downloadText(`整改清单-${today()}.csv`, csv);
  }

  function exportProjectReport() {
    const groups = groupBy(filteredIssues, i => i.projectId);
    const ids = Object.keys(groups);
    if (ids.length === 0) { toast.error("没有可导出的数据"); return; }
    if (ids.length > 1) { toast.message("提示", { description: "建议先按项目筛选后导出，以免混在一起" }); }
    for (const pid of ids) {
      const project = store.projects.find(p => p.id === pid);
      exportProjectPDF(project || { name: pid }, groups[pid]);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1"/> 导出CSV</Button>
      <Button onClick={exportProjectReport}><FileDown className="w-4 h-4 mr-1"/> 导出项目报告PDF</Button>
    </div>
  );
}

function groupBy(arr, fn) {
  return arr.reduce((m, x) => {
    const k = fn(x);
    (m[k] ||= []).push(x);
    return m;
  }, {});
}

function SettingsPage({ store, setStore }) {
  const [templates, setTemplates] = useState(store.templates);

  function addTemplate() {
    setTemplates(ts => [...ts, { id: uid(), name: "新模板", items: ["示例检查项 1", "示例检查项 2"] }]);
  }
  function save() {
    setStore(s => ({ ...s, templates }));
    toast.success("模板已保存");
  }
  function remove(idx) {
    setTemplates(ts => ts.filter((_,i)=>i!==idx));
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>查验模板管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.map((t, idx) => (
            <div key={t.id} className="border rounded-2xl p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={t.name} onChange={(e)=>{
                  const v = e.target.value; setTemplates(ts => ts.map(x => x.id===t.id? { ...x, name: v } : x));
                }} />
                <Button variant="destructive" onClick={()=>remove(idx)}><Trash2 className="w-4 h-4"/></Button>
              </div>
              {t.items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={it} onChange={(e)=>{
                    const v = e.target.value; setTemplates(ts => ts.map(x => x.id===t.id? { ...x, items: x.items.map((y, j)=> j===i? v : y) } : x));
                  }} />
                  <Button variant="outline" onClick={()=>{
                    setTemplates(ts => ts.map(x => x.id===t.id? { ...x, items: x.items.filter((_,j)=>j!==i) } : x));
                  }}>删除</Button>
                </div>
              ))}
              <Button variant="outline" onClick={()=>{
                setTemplates(ts => ts.map(x => x.id===t.id? { ...x, items: [...x.items, "新的检查项"] } : x));
              }}><Plus className="w-4 h-4 mr-1"/> 添加检查项</Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={addTemplate}><Plus className="w-4 h-4 mr-1"/> 新增模板</Button>
            <Button variant="outline" onClick={save}><Save className="w-4 h-4 mr-1"/> 保存模板</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>项目信息与备份</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CreateProjectDialog store={store} setStore={setStore} />
          <BackupButtons store={store} setStore={setStore} />
          <div className="text-xs text-slate-500">提示：所有数据保存在本机浏览器（localStorage），适合离线环境；换设备前请先导出备份 JSON 或 CSV/PDF。</div>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupButtons({ store, setStore }) {
  async function exportJSON() {
    downloadText(`查验数据备份-${today()}.json`, JSON.stringify(store, null, 2));
  }

  async function importJSON() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text = await readFileText(file);
        const data = JSON.parse(text);
        if (!data.projects || !data.issues) throw new Error("文件格式不正确");
        setStore(data);
        toast.success("已导入备份");
      } catch (e) {
        toast.error("导入失败：" + (e.message || "格式错误"));
      }
    };
    input.click();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportJSON}><Download className="w-4 h-4 mr-1"/> 导出备份JSON</Button>
      <Button variant="outline" onClick={importJSON}><Upload className="w-4 h-4 mr-1"/> 导入备份JSON</Button>
    </div>
  );
}
