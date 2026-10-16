import {scopedControls} from './scoped-filters';
import type { Job, Profile } from '../core/domain';
import { projectSummaries, type ProjectRoot } from '../core/projects';
import { statusLabel, translator, type Language } from '../core/i18n';
import { escapeHtml as h } from './html';

export function renderProjectsPanel(roots: ProjectRoot[], jobs: Job[], profiles: Profile[], language: Language,isolateTasks=false,openTasksInCodex=false): string {
  const t=translator(language), tr=(message:string,...values:unknown[])=>h(t(message,...values));
  return `<h2>${tr('Projects')}</h2><p class="muted">${tr('Tasks are grouped automatically by their working folder. Each project shows its own agents and progress.')}</p><label class="check-row"><input type="checkbox" data-setting="isolateTasks" ${isolateTasks?'checked':''}>${tr('Create a separate Git worktree for each new task')}</label><p class="muted">${tr('Requires committed source changes. Task branches and folders are kept for review; nothing is merged automatically.')}</p><label class="check-row"><input type="checkbox" data-setting="openTasksInCodex" ${openTasksInCodex?'checked':''}>${tr('Prepare a Codex desktop chat for each new task')}</label><p class="muted">${tr('Opens the task folder once when execution starts. You send prompts in Codex; RelayCrew continues its own CLI workflow.')}</p>`+
    scopedControls('projects',language)+projectSummaries(roots,jobs).map(project=>{
      const active=project.jobs.filter(job=>['running','queued'].includes(job.status));
      return `<section data-scope-row="projects"><div class="row"><h2>${h(project.name)}</h2><span class="badge">${tr(project.open?'Open workspace':'Task history')}</span></div><p class="muted">${h(project.path)}</p>
      <p>${tr('{0} tasks · {1} running / queued · {2} waiting for your reply',project.jobs.length,active.length,project.jobs.filter(job=>job.status==='waiting_owner').length)}</p>
      ${project.open?`<button data-action="projectTask" data-id="${h(project.path)}">${tr('New task in project')}</button>`:''}
      <button data-action="projectFolder" data-id="${h(project.path)}">${tr('Show folder')}</button><button data-action="projectCodex" data-id="${h(project.path)}">${tr('Open project chat in Codex')}</button>
      ${project.jobs.length?'<ul>'+project.jobs.slice().reverse().slice(0,20).map(job=>{
        const step=job.steps.find(step=>step.status==='running'),profile=step?.profileId?profiles.find(profile=>profile.id===step.profileId):undefined;
        return `<li><button data-action="report" data-id="${h(job.id)}">${h(job.prompt.slice(0,100))}</button> <span class="muted">${h(statusLabel(job.status,language))}${profile?' · '+h(profile.label)+' · '+h(step?.model||t('CLI default')):''}</span>${job.worktree?`<small>${tr('Task worktree')}: ${h(job.cwd)} · ${h(job.worktree.branch)}</small><button data-action="projectCodex" data-id="${h(job.cwd)}">${tr('Open task folder in Codex')}</button><button data-action="projectFolder" data-id="${h(job.cwd)}">${tr('Show folder')}</button>`:job.isolationMode==='worktree'?'<small>'+tr('Worktree will be prepared before the task starts.')+'</small>':''}${job.codexLinkError?'<small class="warning">'+h(job.codexLinkError)+'</small>':''}</li>`;
      }).join('')+'</ul>':'<p>'+tr('No tasks in this project yet.')+'</p>'}</section>`;
    }).join('')+`<p class="muted">${tr('Codex opens a new chat for this local folder. It does not submit a prompt, switch accounts, or create sidebar groups. Desktop app required.')}</p>`;
}
