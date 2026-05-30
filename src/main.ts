import './styles/main.css';

import { ilToast, ilConfirm } from './utils/ui';
import { loadS } from './services/storage';
import { firebaseSync } from './services/firebase';
import { registerRenderers, goPage } from './nav/router';
import { renderHome, homeCalToggle, homeWeekNav, homeWeekReset, toggleHomeProgram, selectHomeDay, homeCalNavMonth, renderHomeProgram, renderHomeCalStrip, renderHomeTodayCard, toggleTodayCardExes } from './pages/home';
import { renderCal, selectDay, renderCalDet, toggleCalExp, showDayOpts, confirmAct, initCalendarDelegation } from './pages/calendar';
import { renderWorkouts, switchWTab } from './pages/workouts/index';
import { renderHistory, switchHTab, renderProgTab, selProgMG, toggleProgEx, showProgData } from './pages/history';
import { renderStats } from './pages/stats';
import {
  initWizardHandlers, goWiz, wizSetName, wizNext, wAdj, renderRestGrid, toggleRest, pickWizDate,
  renderWizStep2, renderWizWeekCircles, toggleWizWeek, renderWizDayCircles,
  renderWizDay, wizSelDay, wizSetDayName, wizToggleSS, wizAdjSets, wizToggleFST7, wizDelEx,
  renderWizStep3, w3ToggleDay, w3SelWeek, saveWiz, activateWiz, triggerImport, handleImport,
  startWizDrag, renderLibrary, activateSavedProg, loadProgToWiz,
} from './pages/workouts/wizard';
import { handleSessionBtn, openSession, closeSession, completeWorkout, toggleTimer, restartSession, resumeSession } from './session/index';
import { renderSP, setV, tickSet, addSet, delSet, nextExercise, toggleEx } from './session/render';
import { openCV, closeCV } from './session/completed';
import { openSM, closeSM, smSelMG, renderSMlist, filterSwap, smPickEx, renderManMG, useManual, doSwap } from './modals/swap';
import { openAEM, closeAEM, renderAEMgrid, renderAEMlist, toggleAEM, confirmAEM, aemSelMG, aemSelCustomMG, toggleAEMCustom, renderAEMCustomPills, confirmAEMCustom } from './modals/addExercise';

function exitApp(): void {
  // Show instruction immediately (window.close() is unreliable on mobile PWA)
  ilToast('Press the home button to exit', 'info');
  setTimeout(() => { try { window.close(); } catch (_) {} }, 250);
}

function init(): void {
  loadS();

  registerRenderers([
    renderHome,
    renderCal,
    renderWorkouts,
    renderHistory,
    renderStats,
  ]);

  initWizardHandlers();
  initCalendarDelegation();

  // Buttons that have no onclick attribute and need event listeners
  document.getElementById('spDoneBtn')?.addEventListener('click', completeWorkout);
  document.getElementById('spAddExBtn')?.addEventListener('click', () => openAEM('session'));
  document.getElementById('cvBackBtn')?.addEventListener('click', closeCV);
  document.getElementById('cvBackBtn2')?.addEventListener('click', closeCV);
  document.getElementById('cvRestartBtn')?.addEventListener('click', restartSession);
  document.getElementById('smClose')?.addEventListener('click', closeSM);
  document.getElementById('aemClose')?.addEventListener('click', closeAEM);

  firebaseSync({
    renderHome,
    renderCal,
    renderWorkouts,
    renderHistory,
    renderStats,
  });

  renderHome();
  renderCal();
  renderWorkouts();
  renderHistory();
  renderStats();

  goPage(0);
}

// Expose all functions that inline onclick handlers reference
Object.assign(window, {
  // Navigation
  goPage,

  // Home page
  renderHome, homeCalToggle, homeWeekNav, homeWeekReset, toggleHomeProgram,
  selectHomeDay, homeCalNavMonth, renderHomeProgram, renderHomeCalStrip, renderHomeTodayCard, toggleTodayCardExes,

  // Calendar page
  renderCal, selectDay, renderCalDet, toggleCalExp, showDayOpts, confirmAct,

  // Workouts page
  renderWorkouts, switchWTab,

  // History page
  renderHistory, switchHTab, renderProgTab, selProgMG, toggleProgEx, showProgData,

  // Stats page
  renderStats,

  // Wizard
  goWiz, wizSetName, wizNext, wAdj, renderRestGrid, toggleRest, pickWizDate,
  renderWizStep2, renderWizWeekCircles, toggleWizWeek, renderWizDayCircles,
  renderWizDay, wizSelDay, wizSetDayName, wizToggleSS, wizAdjSets, wizToggleFST7, wizDelEx,
  renderWizStep3, w3ToggleDay, w3SelWeek, saveWiz, activateWiz, triggerImport, handleImport,
  startWizDrag, renderLibrary, activateSavedProg, loadProgToWiz,

  // Session
  handleSessionBtn, openSession, closeSession, completeWorkout, toggleTimer, restartSession, resumeSession,
  renderSP, setV, tickSet, addSet, delSet, nextExercise, toggleEx,
  openCV, closeCV,

  // Swap modal
  openSM, closeSM, smSelMG, renderSMlist, filterSwap, smPickEx, renderManMG, useManual, doSwap,

  // Add Exercise modal
  openAEM, closeAEM, renderAEMgrid, renderAEMlist, toggleAEM, confirmAEM,
  aemSelMG, aemSelCustomMG, toggleAEMCustom, renderAEMCustomPills, confirmAEMCustom,

  // UI utilities
  ilToast, ilConfirm,

  // App
  exitApp,
});

document.addEventListener('DOMContentLoaded', init);
