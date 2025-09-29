export function setPrefix(prefix) {
localStorage.setItem('kzn_prefix', prefix)
}


export function getPrefix() {
return localStorage.getItem('kzn_prefix') || ''
}


export function clearSession() {
localStorage.removeItem('kzn_prefix')
}