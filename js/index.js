/* ========================================
   GLOBAL VARIABLES
   contacts: array of contact objects, persisted to localStorage
   currentIndex: index of the contact currently being edited, -1 = none
   selectedImage: base64 data of the photo picked in the modal (or '' if none)
======================================== */
var contacts = [];
var currentIndex = -1;

/* ========================================
   AVATAR HELPERS
======================================== */

// Returns the initials to show inside an avatar square (e.g. "Ahmed Ali" -> "AA")
function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join('');
}

// Picks one of the 6 pre-made gradient classes based on the contact's
// position, so avatars get some visual variety instead of one flat color.
function getAvatarClass(index) {
  var gradients = ['avatar-grad-1', 'avatar-grad-2', 'avatar-grad-3', 'avatar-grad-4', 'avatar-grad-5', 'avatar-grad-6'];
  return gradients[index % gradients.length];
}

// Prevents HTML/JS injection when a contact's text is inserted into the page.
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ========================================
   LOCAL STORAGE
======================================== */

// Loads any previously saved contacts from localStorage into the
// global `contacts` array. Falls back to an empty array if nothing
// is stored yet or the saved data can't be parsed.
function loadContacts() {
  try {
    if (localStorage.getItem('contacts') !== null) {
      contacts = JSON.parse(localStorage.getItem('contacts'));
    }
  } catch (e) {
    contacts = [];
  }
}

// Persists the current `contacts` array to localStorage.
function saveContacts() {
  localStorage.setItem('contacts', JSON.stringify(contacts));
}

/* ========================================
   FORM HELPERS
======================================== */

// Reads and trims all Add/Edit Contact modal fields into one object.
function getFormData() {
  var groupValue = document.getElementById('contactGroup').value;

  return {
    name: document.getElementById('contactName').value.trim(),
    phone: document.getElementById('contactPhone').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    address: document.getElementById('contactAddress').value.trim(),
    group: groupValue === 'Select a group' ? '' : groupValue,
    notes: document.getElementById('contactNotes').value.trim(),
    fav: document.getElementById('favoriteSwitch').checked,
    emg: document.getElementById('emergencySwitch').checked,
    image: document.getElementById("photoInput").files[0]
    ? "images/" + document.getElementById("photoInput").files[0].name
    : ""
  };
}

// Resets all Add/Edit Contact modal fields to their default state.
function clearForm() {
  document.getElementById('contactForm').reset();
  resetPhotoPreview();
}

/* ========================================
   PHOTO UPLOAD
   Browsers never expose a picked file's real path (security), only its
   name and content. FileReader.readAsDataURL() converts the file's
   content into a base64 string we can put straight into <img src="...">
   and store alongside the contact.
======================================== */

function handlePhotoSelect() {
  var file = document.getElementById("photoInput").files[0];

  if (!file) return;

  var imagePath = "images/" + file.name;

  document.getElementById("photoPreview").innerHTML =
    '<img src="' + imagePath + '" alt="Contact photo">';
}

// Puts the photo circle back to the default person icon and clears the
// picked file, so the next "Add" doesn't carry over a previous photo.
function resetPhotoPreview() {
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreview').innerHTML = '<i class="fa-solid fa-user"></i>';
}

/* ========================================
   LIVE FIELD VALIDATION (Name / Phone)
   Toggles Bootstrap's .is-invalid class as the user types, which
   automatically shows/hides the .invalid-feedback hint next to it.
======================================== */

function validateNameLive() {
  var nameInput = document.getElementById('contactName');
  var nameRegex = /^[A-Za-z\u0600-\u06FF\s]{2,50}$/;

  if (nameRegex.test(nameInput.value.trim())) {
    nameInput.classList.remove('is-invalid');
  } else {
    nameInput.classList.add('is-invalid');
  }
}

function validatePhoneLive() {
  var phoneInput = document.getElementById('contactPhone');
  var egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;

  if (egyptianPhoneRegex.test(phoneInput.value.trim())) {
    phoneInput.classList.remove('is-invalid');
  } else {
    phoneInput.classList.add('is-invalid');
  }
}

/* ========================================
   VALIDATION
======================================== */

// Checks the required fields and stops at the first problem found.
// Returns true only when everything passes.
function validateContact(contact) {
  var egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (contact.name === '') {
    Swal.fire({ icon: 'error', title: 'Missing Field', text: 'Please enter the contact name.' });
    return false;
  }
  if (contact.name.length < 2) {
    Swal.fire({ icon: 'error', title: 'Invalid Name', text: 'Name must be at least 2 characters.' });
    return false;
  }

  if (contact.phone === '') {
    Swal.fire({ icon: 'error', title: 'Missing Field', text: 'Please enter the phone number.' });
    return false;
  }
  if (!egyptianPhoneRegex.test(contact.phone)) {
    Swal.fire({ icon: 'error', title: 'Invalid Phone', text: 'Please enter a valid Egyptian phone number (e.g., 01012345678).' });
    return false;
  }

  // Email is optional, but if the person typed something it has to look valid
  if (contact.email !== '' && !emailRegex.test(contact.email)) {
    Swal.fire({ icon: 'error', title: 'Invalid Email', text: 'Please enter a valid email address.' });
    return false;
  }

  // Duplicate phone check (ignore the contact currently being edited)
  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].phone === contact.phone && i !== currentIndex) {
      Swal.fire({ icon: 'error', title: 'Duplicate Phone', text: 'This phone number is already registered under "' + contacts[i].name + '".' });
      return false;
    }
  }

  return true;
}

/* ========================================
   CRUD OPERATIONS
======================================== */

// Called by the "Save Contact" / "Save Changes" button (onclick="saveContact()").
// Adds a new contact, OR updates the one being edited, depending on currentIndex.
function saveContact() {
  var contact = getFormData();

  if (!validateContact(contact)) {
    return;
  }

  var isEditing = currentIndex !== -1;

  if (isEditing) {
    contacts[currentIndex] = contact;
  } else {
    contacts.push(contact);
  }

  clearForm();
  currentIndex = -1;

  var modal = bootstrap.Modal.getInstance(document.getElementById('addContactModal'));
  modal.hide();

  renderContacts();

  Swal.fire({
    icon: 'success',
    title: 'Success!',
    text: isEditing ? 'Contact updated successfully.' : 'Contact added successfully.',
    timer: 1500,
    showConfirmButton: false
  });
}

// Populates the modal with an existing contact's data for editing.
function editContact(index) {
  currentIndex = index;
  var c = contacts[index];

  document.getElementById('contactName').value = c.name;
  document.getElementById('contactPhone').value = c.phone;
  document.getElementById('contactEmail').value = c.email;
  document.getElementById('contactAddress').value = c.address;
  document.getElementById('contactGroup').value = c.group || 'Select a group';
  document.getElementById('contactNotes').value = c.notes;
  document.getElementById('favoriteSwitch').checked = c.fav;
  document.getElementById('emergencySwitch').checked = c.emg;

  if (c.image) {
    document.getElementById('photoPreview').innerHTML = '<img src="' + c.image + '" alt="Contact photo">';
  } else {
    resetPhotoPreview();
  }

  document.getElementById('addContactModalLabel').textContent = 'Edit Contact';
  document.getElementById('saveContactBtn').querySelector('span').textContent = 'Save Changes';

  var modal = new bootstrap.Modal(document.getElementById('addContactModal'));
  modal.show();
}

// Deletes a contact after a SweetAlert2 confirmation.
function deleteContact(index) {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to recover this contact!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Yes, Delete',
    cancelButtonText: 'Cancel'
  }).then(function (result) {
    if (result.isConfirmed) {
      contacts.splice(index, 1);
      renderContacts();

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Contact deleted successfully.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  });
}

/* ========================================
   FAVORITES / EMERGENCY TOGGLES
======================================== */

// Toggles the favorite flag for a given contact index and re-renders.
function addFav(index) {
  contacts[index].fav = !contacts[index].fav;
  renderContacts();
}

// Toggles the emergency flag for a given contact index and re-renders.
function addEmg(index) {
  contacts[index].emg = !contacts[index].emg;
  renderContacts();
}

/* ========================================
   SEARCH
======================================== */

// Returns the real position of a contact inside the full `contacts`
// array. When rendering a filtered/searched list, each item carries
// an `originalIndex` (set in searchContacts()); this must be checked
// with typeof rather than a truthy check, because index 0 is a
// perfectly valid (but falsy) originalIndex.
function getRealIndex(item, i) {
  if (typeof item.originalIndex !== 'undefined') {
    return item.originalIndex;
  }
  return i;
}

// Filters contacts by name/phone/email as the user types. Each match
// keeps track of its real position (originalIndex) in the full
// `contacts` array, so favorite/emergency toggles and edit/delete
// still target the correct contact while a filter is active.
function searchContacts() {
  var searchTerm = document.getElementById('searchInput').value.toLowerCase();
  var filteredContacts = [];

  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    if (
      c.name.toLowerCase().indexOf(searchTerm) !== -1 ||
      c.phone.indexOf(searchTerm) !== -1 ||
      (c.email || '').toLowerCase().indexOf(searchTerm) !== -1
    ) {
      filteredContacts.push({
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
        fav: c.fav,
        emg: c.emg,
        group: c.group,
        originalIndex: i
      });
    }
  }

  display(filteredContacts);
}

/* ========================================
   COUNTERS
======================================== */

// Updates the "TOTAL" stat card and the "Manage and organize your X contacts" line.
function updateContactCount() {
  var count = contacts.length;
  document.querySelectorAll('.stat-value')[0].textContent = count;
  document.getElementById('contactCount').textContent = count;
}

// Updates the "FAVORITES" stat card counter.
function updateFavoritesCounter() {
  var count = 0;
  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].fav) count++;
  }
  document.querySelectorAll('.stat-value')[1].textContent = count;
}

// Updates the "EMERGENCY" stat card counter.
function updateEmergencyCounter() {
  var count = 0;
  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].emg) count++;
  }
  document.querySelectorAll('.stat-value')[2].textContent = count;
}

/* ========================================
   SIDEBAR PANELS (Favorites / Emergency)
======================================== */

function displayFavorites() {
  var html = '';
  var count = 0;

  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].fav) {
      count++;
      var favAvatar = contacts[i].image
        ? '<img src="' + contacts[i].image + '" alt="' + escapeHtml(contacts[i].name) + '">'
        : getInitials(contacts[i].name);
      html +=
        '<div class="side-contact-row">' +
          '<div class="side-contact-avatar ' + getAvatarClass(i) + '">' + favAvatar + '</div>' +
          '<div class="overflow-hidden">' +
            '<p class="side-contact-name mb-0">' + escapeHtml(contacts[i].name) + '</p>' +
            '<p class="side-contact-phone mb-0">' + escapeHtml(contacts[i].phone) + '</p>' +
          '</div>' +
          '<a href="tel:' + escapeHtml(contacts[i].phone) + '" class="side-call-btn side-call-btn-fav">' +
            '<i class="fa-solid fa-phone"></i>' +
          '</a>' +
        '</div>';
    }
  }

  document.getElementById('favList').innerHTML = html;
  document.getElementById('favEmpty').style.display = count > 0 ? 'none' : 'block';
}

function displayEmergency() {
  var html = '';
  var count = 0;

  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].emg) {
      count++;
      var emgAvatar = contacts[i].image
        ? '<img src="' + contacts[i].image + '" alt="' + escapeHtml(contacts[i].name) + '">'
        : getInitials(contacts[i].name);
      html +=
        '<div class="side-contact-row">' +
          '<div class="side-contact-avatar ' + getAvatarClass(i) + '">' + emgAvatar + '</div>' +
          '<div class="overflow-hidden">' +
            '<p class="side-contact-name mb-0">' + escapeHtml(contacts[i].name) + '</p>' +
            '<p class="side-contact-phone mb-0">' + escapeHtml(contacts[i].phone) + '</p>' +
          '</div>' +
          '<a href="tel:' + escapeHtml(contacts[i].phone) + '" class="side-call-btn side-call-btn-emg">' +
            '<i class="fa-solid fa-phone"></i>' +
          '</a>' +
        '</div>';
    }
  }

  document.getElementById('emgList').innerHTML = html;
  document.getElementById('emgEmpty').style.display = count > 0 ? 'none' : 'block';
}

/* ========================================
   MAIN LIST RENDERING
======================================== */

var GROUP_TAG_CLASS = {
  Family: 'tag-family',
  Friends: 'tag-friends',
  Work: 'tag-work',
  School: 'tag-school',
  Other: 'tag-other'
};

// Renders the main contact list from a given array of contacts
// (used for both the full list and filtered/search results).
function display(arr) {
  var html = '';

  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    var realIndex = getRealIndex(c, i);

    var favBadge = c.fav
      ? '<span class="avatar-badge avatar-badge-fav"><i class="fa-solid fa-star"></i></span>'
      : '';
    var emgBadge = c.emg
      ? '<span class="avatar-badge avatar-badge-emg"><i class="fa-solid fa-heart-pulse"></i></span>'
      : '';

    var emailRow = c.email
      ? '<a href="mailto:' + escapeHtml(c.email) + '" class="contact-detail-row">' +
          '<span class="contact-detail-icon contact-detail-icon-email"><i class="fa-solid fa-envelope"></i></span>' +
          '<span class="contact-detail-text">' + escapeHtml(c.email) + '</span>' +
        '</a>'
      : '';

    var addressRow = c.address
      ? '<div class="contact-detail-row">' +
          '<span class="contact-detail-icon contact-detail-icon-address"><i class="fa-solid fa-location-dot"></i></span>' +
          '<span class="contact-detail-text">' + escapeHtml(c.address) + '</span>' +
        '</div>'
      : '';

    var groupTag = (c.group && GROUP_TAG_CLASS[c.group])
      ? '<span class="tag-pill ' + GROUP_TAG_CLASS[c.group] + '">' + c.group + '</span>'
      : '';
    var emgTag = c.emg
      ? '<span class="tag-pill tag-emergency"><i class="fa-solid fa-heart-pulse"></i>Emergency</span>'
      : '';
    var tagsRow = (groupTag || emgTag)
      ? '<div class="contact-tags">' + groupTag + emgTag + '</div>'
      : '';

    var avatarContent = c.image
      ? '<img src="' + c.image + '" alt="' + escapeHtml(c.name) + '">'
      : getInitials(c.name);

    html +=
      '<div class="col-12 col-md-6">' +
        '<div class="contact-card">' +
          '<div class="contact-card-top">' +
            '<div class="contact-avatar-wrap">' +
              '<div class="contact-avatar ' + getAvatarClass(realIndex) + '">' + avatarContent + '</div>' +
              favBadge +
              emgBadge +
            '</div>' +
            '<div class="flex-grow-1 overflow-hidden">' +
              '<p class="contact-name mb-1">' + escapeHtml(c.name) + '</p>' +
              '<a href="tel:' + escapeHtml(c.phone) + '" class="contact-phone-link">' +
                '<i class="fa-solid fa-phone"></i>' + escapeHtml(c.phone) +
              '</a>' +
            '</div>' +
          '</div>' +

          emailRow +
          addressRow +
          tagsRow +

          '<div class="contact-actions">' +
            '<div class="contact-actions-group">' +
              '<a href="tel:' + escapeHtml(c.phone) + '" class="action-btn action-btn-call" title="Call">' +
                '<i class="fa-solid fa-phone"></i>' +
              '</a>' +
              '<a href="mailto:' + escapeHtml(c.email) + '" class="action-btn action-btn-email" title="Email">' +
                '<i class="fa-solid fa-envelope"></i>' +
              '</a>' +
            '</div>' +
            '<div class="contact-actions-group">' +
              '<button type="button" class="action-btn action-btn-fav ' + (c.fav ? 'active' : '') + '" onclick="addFav(' + realIndex + ')" title="Favorite">' +
                '<i class="fa-solid fa-star"></i>' +
              '</button>' +
              '<button type="button" class="action-btn action-btn-emg ' + (c.emg ? 'active' : '') + '" onclick="addEmg(' + realIndex + ')" title="Emergency">' +
                '<i class="fa-solid fa-heart-pulse"></i>' +
              '</button>' +
              '<button type="button" class="action-btn action-btn-edit" onclick="editContact(' + realIndex + ')" title="Edit">' +
                '<i class="fa-solid fa-pen"></i>' +
              '</button>' +
              '<button type="button" class="action-btn action-btn-delete" onclick="deleteContact(' + realIndex + ')" title="Delete">' +
                '<i class="fa-solid fa-trash"></i>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  document.getElementById('contactsList').innerHTML = html;

  if (arr.length > 0) {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('contactsList').style.display = 'flex';
  } else {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('contactsList').style.display = 'none';
  }
}

/* ========================================
   REFRESH / INIT
======================================== */

// Central place that keeps storage, the main list, the counters,
// and both side panels (favorites/emergency) all in sync.
function renderContacts() {
  saveContacts();
  refreshUI();
}

// Shared "refresh everything on screen" sequence, used both on the
// initial page load and by renderContacts() after any change.
function refreshUI() {
  display(contacts);
  updateContactCount();
  updateFavoritesCounter();
  updateEmergencyCounter();
  displayFavorites();
  displayEmergency();
}

/* ========================================
   INITIALIZATION
======================================== */
loadContacts();
refreshUI();

// Note: "Save Contact" now uses onclick="saveContact()" directly in the HTML,
// and the search box uses oninput="searchContacts()" directly in the HTML,
// so no addEventListener calls are needed for those two anymore.

// There's no HTML attribute equivalent for Bootstrap's custom "hidden.bs.modal"
// event, so this one still has to be wired up here in JS.
// If the user closes the modal without saving (X, Cancel, backdrop click),
// reset it back to "Add" mode for next time.
document.getElementById('addContactModal').addEventListener('hidden.bs.modal', function () {
  clearForm();
  currentIndex = -1;
  document.getElementById('contactName').classList.remove('is-invalid');
  document.getElementById('contactPhone').classList.remove('is-invalid');
  document.getElementById('addContactModalLabel').textContent = 'Add New Contact';
  document.getElementById('saveContactBtn').querySelector('span').textContent = 'Save Contact';
});