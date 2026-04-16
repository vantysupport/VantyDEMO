export const generateTimeSlots = () => {
  const slots = []
  let startHour = 8
  let startMin = 15
  const endHour = 18
  const endMin = 15

  while (startHour < endHour || (startHour === endHour && startMin < endMin)) {
    const timeString = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`
    slots.push(timeString)
    startMin += 45
    if (startMin >= 60) { startHour += 1; startMin -= 60 }
  }
  return slots
}

export const TIME_SLOTS = generateTimeSlots()

export const calculateAge = (birthDate: string) => {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return Math.max(0, age)
}
