import { mount } from 'svelte'
import App from './App.svelte'
import '../settings/api' // the tour talks to main through the Settings bridge
import '../tokens.css'

mount(App, { target: document.getElementById('app')! })
