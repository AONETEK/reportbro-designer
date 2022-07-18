import MovePanelItemCmd from '../commands/MovePanelItemCmd';
import AddDeleteDocElementCmd from '../commands/AddDeleteDocElementCmd';
import SetValueCmd from '../commands/SetValueCmd';
import Band from '../container/Band';
import Parameter from '../data/Parameter';
import * as utils from '../utils';

/**
 * Base class for all doc elements.
 * @class
 */
export default class DocElement {
    constructor(name, id, defaultWidth, defaultHeight, rb) {
        this.rb = rb;
        this.id = id;
        this.name = name;
        this.panelItem = null;
        this.x = '0';
        this.y = '0';
        this.width = '' + defaultWidth;
        this.height = '' + defaultHeight;
        this.containerId = null;
        // in case of frame or band element, this is the container represented by the element
        this.linkedContainerId = null;
        this.printIf = '';
        this.removeEmptyElement = false;

        this.el = null;
        this.selected = false;

        this.xVal = 0;
        this.yVal = 0;
        this.widthVal = 0;
        this.heightVal = 0;

        this.errors = [];
    }

    setInitialData(initialData) {
        for (let key in initialData) {
            if (initialData.hasOwnProperty(key) && this.hasOwnProperty(key)) {
                this[key] = initialData[key];
            }
        }

        // make sure x, y, width and height are strings (they are stored as numbers when serialized)
        this.x = '' + this.x;
        this.y = '' + this.y;
        this.width = '' + this.width;
        this.height = '' + this.height;

        this.xVal = utils.convertInputToNumber(this.x);
        this.yVal = utils.convertInputToNumber(this.y);
        this.widthVal = utils.convertInputToNumber(this.width);
        this.heightVal = utils.convertInputToNumber(this.height);
    }

    /**
     * Called after initialization is finished.
     */
    setup(openPanelItem) {
        let container = this.getContainer();
        if (container !== null) {
            // adapt position if new element is outside container
            let containerSize = container.getContentSize();
            if (this.xVal + this.widthVal > containerSize.width) {
                this.xVal = containerSize.width - this.widthVal;
            }
            if (this.xVal < 0) {
                this.xVal = 0;
            }
            if (this.yVal + this.heightVal > containerSize.height) {
                this.yVal = containerSize.height - this.heightVal;
            }
            if (this.yVal < 0) {
                this.yVal = 0;
            }
            this.x = '' + this.xVal;
            this.y = '' + this.yVal;
        }
    }

    /**
     * Register event handler for a container element so it can be dragged and
     * allow selection on double click.
     */
    registerContainerEventHandlers() {
        this.el.addEventListener('dblclick', (event) => {
            if (!this.rb.isSelectedObject(this.id)) {
                this.rb.selectObject(this.id, true);
                event.stopPropagation();
            }
        });
        this.el.addEventListener('mousedown', (event) => {
            if (event.shiftKey) {
                this.rb.deselectObject(this.id);
                event.stopPropagation();
            } else {
                if (this.rb.isSelectedObject(this.id)) {
                    this.rb.getDocument().startDrag(
                        event.pageX, event.pageY,
                        this.id, this.containerId, this.linkedContainerId,
                        this.getElementType(), DocElement.dragType.element);
                    event.stopPropagation();
                } else {
                    this.rb.deselectAll(true);
                }
            }
        });
        this.el.addEventListener('touchstart', (event) => {
            if (this.rb.isSelectedObject(this.id)) {
                let absPos = utils.getEventAbsPos(event);
                this.rb.getDocument().startDrag(absPos.x, absPos.y,
                    this.id, this.containerId, this.linkedContainerId,
                    this.getElementType(), DocElement.dragType.element);
            }
            event.preventDefault();
        });
        this.el.addEventListener('touchmove', (event) => {
            this.rb.getDocument().processDrag(event);
        });
        this.el.addEventListener('touchend', (event) => {
            this.rb.getDocument().stopDrag();
        });
    }

    /**
     * Register event handlers so element can be selected, dragged and resized.
     */
    registerEventHandlers() {
        this.el.addEventListener('dblclick', (event) => {
            this.handleDoubleClick(event);
        });
        this.el.addEventListener('mousedown', (event) => {
            this.handleClick(event, false);
        });
        this.el.addEventListener('touchstart', (event) => {
            if (!this.rb.isSelectedObject(this.id)) {
                this.handleClick(event, true);
            } else {
                let absPos = utils.getEventAbsPos(event);
                this.rb.getDocument().startDrag(absPos.x, absPos.y,
                    this.id, this.containerId, this.linkedContainerId,
                    this.getElementType(), DocElement.dragType.element);
                event.preventDefault();
            }
        });
        this.el.addEventListener('touchmove', (event) => {
            if (this.rb.isSelectedObject(this.id)) {
                this.rb.getDocument().processDrag(event);
            }
        });
        this.el.addEventListener('touchend', (event) => {
            if (this.rb.isSelectedObject(this.id)) {
                this.rb.getDocument().stopDrag();
            }
        });
    }

    handleDoubleClick(event) {
        this.handleClick(event, true);
    }

    /**
     * Handle mouse click on this element so the element can be selected, dragged and resized.
     * @param {jQuery.Event} event - browser event object.
     * @param {Boolean} ignoreSelectedContainer - if true the element will always be selected in case it
     * was not selected before. Otherwise the element will only be selected if it's container is
     * not selected (e.g. the frame container when this element is inside a frame).
     */
    handleClick(event, ignoreSelectedContainer) {
        if (!this.rb.isSelectedObject(this.id)) {
            if (ignoreSelectedContainer || !this.isContainerSelected()) {
                let allowSelection = true;
                if (event.shiftKey) {
                    // do not allow selecting element if one of its children is already selected
                    let children = [];
                    this.appendContainerChildren(children);
                    for (let child of children) {
                        if (this.rb.isSelectedObject(child.getId())) {
                            allowSelection = false;
                            break;
                        }
                    }
                }
                if (allowSelection) {
                    this.rb.selectObject(this.id, !event.shiftKey);
                }
                event.stopPropagation();
            }
        } else {
            if (event.shiftKey) {
                this.rb.deselectObject(this.id);
            } else if (!ignoreSelectedContainer) {
                this.rb.getDocument().startDrag(
                    event.pageX, event.pageY,
                    this.id, this.containerId, this.linkedContainerId,
                    this.getElementType(), DocElement.dragType.element);
            }
            event.stopPropagation();
        }
    }

    getId() {
        return this.id;
    }

    /**
     * Returns highest id of this component including all its child components.
     * @returns {Number}
     */
    getMaxId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getPanelItem() {
        return this.panelItem;
    }

    setPanelItem(panelItem) {
        this.panelItem = panelItem;
    }

    getContainerId() {
        return this.containerId;
    }

    getContainer() {
        return this.rb.getDataObject(this.getContainerId());
    }

    getLinkedContainer() {
        if (this.linkedContainerId !== null) {
            return this.rb.getDataObject(this.linkedContainerId);
        }
        return null;
    }

    /**
     * Return array with linked container(s) of this element.
     * @return {Container[]}
     */
    getLinkedContainers() {
        const linkedContainer = this.getLinkedContainer();
        if (linkedContainer) {
            return [linkedContainer];
        }
        return [];
    }

    getContainerContentSize() {
        let container = this.getContainer();
        return (container !== null) ? container.getContentSize() : { width: 0, height: 0 };
    }

    appendToContainer() {
        let container = this.getContainer();
        if (container !== null) {
            container.appendElement(this.el);
        }
    }

    isContainerSelected() {
        let container = this.getContainer();
        if (container !== null) {
            return container.isSelected();
        }
        return false;
    }

    appendContainerChildren(elements) {
        if (this.linkedContainerId !== null) {
            if (this.panelItem !== null) {
                let children = this.panelItem.getChildren();
                for (let child of children) {
                    if (child.getData() instanceof DocElement) {
                        elements.push(child.getData());
                        child.getData().appendContainerChildren(elements);
                    }
                }
            }
        }
    }

    /**
     * Returns absolute position inside document.
     * @returns {Object} x and y coordinates.
     */
    getAbsolutePosition() {
        let pos = { x: this.xVal, y: this.yVal };
        let container = this.getContainer();
        if (container !== null) {
            let offset = container.getOffset();
            pos.x += offset.x;
            pos.y += offset.y;
        }
        return pos;
    }

    /**
     * Check element bounds within container and adapt position/size if necessary.
     *
     * This should be called when an element is resized or moved to another container to guarantee that
     * the element is not out of bounds.
     * @param {Number} x - x value of doc element.
     * @param {Number} y - y value of doc element.
     * @param {Number} width - width value of doc element.
     * @param {Number} height - height value of doc element.
     * @param {Object} containerSize - width and height of container where this doc element belongs to.
     * @param {CommandGroupCmd} cmdGroup - possible SetValue commands will be added to this command group.
     */
    checkBounds(x, y, width, height, containerSize, cmdGroup) {
        if ((x + width) > containerSize.width) {
            x = containerSize.width - width;
        }
        if (x < 0)  {
            x = 0;
        }
        if ((x + width) > containerSize.width) {
            width = containerSize.width - x;
        }
        if ((y + height) > containerSize.height) {
            y = containerSize.height - height;
        }
        if (y < 0)  {
            y = 0;
        }
        if ((y + height) > containerSize.height) {
            height = containerSize.height - y;
        }

        if (x !== this.xVal && this.hasProperty('x')) {
            let cmd = new SetValueCmd(
                this.id, 'x', '' + x, SetValueCmd.type.text, this.rb);
            cmd.disableSelect();
            cmdGroup.addCommand(cmd);
        }
        if (y !== this.yVal && this.hasProperty('y')) {
            let cmd = new SetValueCmd(
                this.id, 'y', '' + y, SetValueCmd.type.text, this.rb);
            cmd.disableSelect();
            cmdGroup.addCommand(cmd);
        }
        if (width !== this.getDisplayWidth() && this.hasProperty('width')) {
            this.addCommandsForChangedWidth(width, true, cmdGroup);
        }
        if (height !== this.getDisplayHeight() && this.hasProperty('height')) {
            let cmd = new SetValueCmd(
                this.id, 'height', '' + height, SetValueCmd.type.text, this.rb);
            cmd.disableSelect();
            cmdGroup.addCommand(cmd);
        }

        let linkedContainer = this.getLinkedContainer();
        if (linkedContainer !== null && linkedContainer.getPanelItem() !== null) {
            let linkedContainerSize = { width: width, height: height };
            for (let child of linkedContainer.getPanelItem().getChildren()) {
                if (child.getData() instanceof DocElement) {
                    let docElement = child.getData();
                    docElement.checkBounds(docElement.getValue('xVal'), docElement.getValue('yVal'),
                        docElement.getDisplayWidth(), docElement.getDisplayHeight(),
                        linkedContainerSize, cmdGroup);
                }
            }
        }
    }

    getValue(field) {
        return this[field];
    }

    setValue(field, value) {
        this[field] = value;
        if (field === 'x' || field === 'y' || field === 'width' || field === 'height') {
            this[field + 'Val'] = utils.convertInputToNumber(value);
            this.updateDisplay();
        } else if (field === 'containerId') {
            if (this.el !== null) {
                // detach dom node from container and then attach it to new container
                this.el.parentElement.removeChild(this.el);
                this.appendToContainer();
            }
            // set new parent for linked containers
            const linkedContainers = this.getLinkedContainers();
            if (linkedContainers.length > 0) {
                const container = this.getContainer();
                for (const linkedContainer of linkedContainers) {
                    linkedContainer.setParent(container);
                }
            }
            // update level of all containers as the level could have changed in case container
            // belongs to this element
            for (const container of this.rb.getContainers()) {
                container.initLevel();
            }
        } else if (['styleId', 'bold', 'italic', 'underline', 'strikethrough',
                'horizontalAlignment', 'verticalAlignment',
                'textColor', 'backgroundColor', 'font', 'fontSize', 'lineSpacing', 'borderColor', 'borderWidth',
                'borderAll', 'borderLeft', 'borderTop', 'borderRight', 'borderBottom',
                'paddingLeft', 'paddingTop', 'paddingRight', 'paddingBottom'].indexOf(field) !== -1) {

            this.updateStyle();

            if (['borderWidth', 'borderAll', 'borderLeft', 'borderTop', 'borderRight', 'borderBottom',
                'paddingLeft', 'paddingTop', 'paddingRight', 'paddingBottom'].indexOf(field) !== -1) {
                this.updateDisplay();
            }
        }
    }

    /**
     * Returns value to use for updating input control.
     * Can be overridden in case update value can be different from internal value, e.g.
     * width for table cells with colspan > 1.
     * @param {String} field - field name.
     * @param {String} value - value for update.
     */
    getUpdateValue(field, value) {
        return value;
    }

    getDisplayWidth() {
        return this.widthVal;
    }

    getDisplayHeight() {
        return this.heightVal;
    }

    /**
     * Returns all data fields of this object. The fields are used when serializing the object.
     * @returns {String[]}
     */
    getFields() {
        let fields = this.getProperties();
        fields.splice(0, 0, 'id', 'containerId');
        return fields;
    }

    /**
     * Returns all fields of this object that can be modified in the properties panel.
     * @returns {String[]}
     */
    getProperties() {
        return [];
    }

    /**
     * Returns true if the given property is available for this object.
     * @param {String} property - property name.
     * @returns {Boolean}
     */
    hasProperty(property) {
        return this.getProperties().indexOf(property) !== -1;
    }

    getElementType() {
        return DocElement.type.none;
    }

    updateDisplay() {
        this.updateDisplayInternal(this.xVal, this.yVal, this.widthVal, this.heightVal);
    }

    updateDisplayInternal(x, y, width, height) {
        if (this.el !== null) {
            this.el.style.left = this.rb.toPixel(x);
            this.el.style.top = this.rb.toPixel(y);
            this.el.style.width = this.rb.toPixel(width);
            this.el.style.height = this.rb.toPixel(height);
        }
    }

    updateStyle() {
    }

    updateChangedStyle(styleId) {
        if (utils.convertInputToNumber(this.styleId) === styleId) {
            this.updateStyle();
        }
    }

    getDragDiff(diffX, diffY, dragType, gridSize) {
        let rv = { x: 0, y: 0 };
        let dragX, dragY;
        let posX1 = this.xVal;
        let posY1 = this.yVal;
        let posX2 = posX1 + this.getDisplayWidth();
        let posY2 = posY1 + this.getDisplayHeight();
        let minWidth = this.getMinWidth();
        let maxWidth = this.getMaxWidth();
        let minHeight = this.getMinHeight();
        if (dragType === DocElement.dragType.element) {
            dragX = posX1 + diffX;
            if (gridSize !== 0) {
                dragX = utils.roundValueToInterval(dragX, gridSize);
            }
            dragY = posY1 + diffY;
            if (gridSize !== 0) {
                dragY = utils.roundValueToInterval(dragY, gridSize);
            }
            rv.x = dragX - posX1;
            rv.y = dragY - posY1;
        } else {
            let containerSize = this.getContainerContentSize();
            if (dragType === DocElement.dragType.sizerNW || dragType === DocElement.dragType.sizerN ||
                    dragType === DocElement.dragType.sizerNE) {
                dragY = posY1 + diffY;
                if (gridSize !== 0) {
                    dragY = utils.roundValueToInterval(dragY, gridSize);
                }
                if (dragY > posY2 - minHeight) {
                    if (gridSize !== 0) {
                        dragY = utils.roundValueToLowerInterval(posY2 - minHeight, gridSize);
                    } else {
                        dragY = posY2 - minHeight;
                    }
                } else if (dragY < 0) {
                    dragY = 0;
                }
                rv.y = dragY - posY1;
            }
            if (dragType === DocElement.dragType.sizerNE || dragType === DocElement.dragType.sizerE ||
                    dragType === DocElement.dragType.sizerSE) {
                dragX = posX2 + diffX;
                if (gridSize !== 0) {
                    dragX = utils.roundValueToInterval(dragX, gridSize);
                }
                if (dragX < posX1 + minWidth) {
                    if (gridSize !== 0) {
                        dragX = utils.roundValueToUpperInterval(posX1 + minWidth, gridSize);
                    } else {
                        dragX = posX1 + minWidth;
                    }
                } else if (dragX > maxWidth) {
                    dragX = maxWidth;
                }
                rv.x = dragX - posX2;
            }
            if (dragType === DocElement.dragType.sizerSE || dragType === DocElement.dragType.sizerS ||
                    dragType === DocElement.dragType.sizerSW) {
                dragY = posY2 + diffY;
                if (gridSize !== 0) {
                    dragY = utils.roundValueToInterval(dragY, gridSize);
                }
                if (dragY < posY1 + minHeight) {
                    if (gridSize !== 0) {
                        dragY = utils.roundValueToUpperInterval(posY1 + minHeight, gridSize);
                    } else {
                        dragY = posY1 + minHeight;
                    }
                } else if (dragY > containerSize.height) {
                    dragY = containerSize.height;
                }
                rv.y = dragY - posY2;
            }
            if (dragType === DocElement.dragType.sizerSW || dragType === DocElement.dragType.sizerW ||
                    dragType === DocElement.dragType.sizerNW) {
                dragX = posX1 + diffX;
                if (gridSize !== 0) {
                    dragX = utils.roundValueToInterval(dragX, gridSize);
                }
                if (dragX > posX2 - minWidth) {
                    if (gridSize !== 0) {
                        dragX = utils.roundValueToLowerInterval(posX2 - minWidth, gridSize);
                    } else {
                        dragX = posX2 - minWidth;
                    }
                } else if (dragX < 0) {
                    dragX = 0;
                }
                rv.x = dragX - posX1;
            }
        }
        return rv;
    }

    updateDrag(diffX, diffY, dragType, dragContainer, cmdGroup) {
        let posX1 = this.xVal;
        let posY1 = this.yVal;
        let posX2 = posX1 + this.getDisplayWidth();
        let posY2 = posY1 + this.getDisplayHeight();
        let maxWidth = this.getMaxWidth();
        let containerSize = this.getContainerContentSize();
        if (dragType === DocElement.dragType.element) {
            posX1 += diffX;
            posX2 = posX1 + this.getDisplayWidth();
            posY1 += diffY;
            posY2 = posY1 + this.getDisplayHeight();
        } else {
            if (dragType === DocElement.dragType.sizerNW || dragType === DocElement.dragType.sizerN ||
                dragType === DocElement.dragType.sizerNE) {
                posY1 += diffY;
            }
            if (dragType === DocElement.dragType.sizerNE || dragType === DocElement.dragType.sizerE ||
                dragType === DocElement.dragType.sizerSE) {
                posX2 += diffX;
            }
            if (dragType === DocElement.dragType.sizerSE || dragType === DocElement.dragType.sizerS ||
                dragType === DocElement.dragType.sizerSW) {
                posY2 += diffY;
            }
            if (dragType === DocElement.dragType.sizerSW || dragType === DocElement.dragType.sizerW ||
                dragType === DocElement.dragType.sizerNW) {
                posX1 += diffX;
            }
            if (posX1 < 0) {
                posX1 = 0;
            }
            if (posX2 < posX1) {
                posX2 = posX1;
            }
            if (posY1 < 0) {
                posY1 = 0;
            }
            if (posY2 < posY1) {
                posY2 = posY1;
            }
            if (posX2 > maxWidth) {
                posX2 = maxWidth;
            }
            if (posY2 > containerSize.height) {
                posY2 = containerSize.height;
            }
        }
        let width = posX2 - posX1;
        let height = posY2 - posY1;
        if (cmdGroup !== null) {
            let containerChanged = false;
            let container = this.getContainer();
            let containerSize = { width: 0, height: 0};
            if (dragContainer !== null && dragContainer.getId() !== this.getContainerId()) {
                containerChanged = true;
                containerSize = dragContainer.getContentSize();
                if (container !== null) {
                    let relativeOffset = dragContainer.getOffsetTo(container);
                    posX1 -= relativeOffset.x;
                    posY1 -= relativeOffset.y;
                }
            } else {
                containerSize = container.getContentSize();
            }
            if (!containerChanged || dragContainer.isElementAllowed(this.getElementType())) {
                this.checkBounds(posX1, posY1, width, height, containerSize, cmdGroup);

                if (containerChanged) {
                    let cmd = new SetValueCmd(
                        this.id, 'containerId', dragContainer.getId(), SetValueCmd.type.internal, this.rb);
                    cmdGroup.addCommand(cmd);
                    cmd = new MovePanelItemCmd(this.getPanelItem(), dragContainer.getPanelItem(),
                        dragContainer.getPanelItem().getChildren().length, this.rb);
                    cmdGroup.addCommand(cmd);
                }

                if (cmdGroup.isEmpty()) {
                    // nothing was changed, make sure displayed element is updated to saved position/size after drag
                    this.updateDisplay();
                }
            } else {
                this.updateDisplay();
            }
        } else {
            this.updateDisplayInternal(posX1, posY1, width, height);
        }
    }

    select() {
        if (this.el !== null) {
            let elSizerContainer = this.getSizerContainerElement();
            let sizers = this.getSizers();
            for (let sizer of sizers) {
                let sizerVal = sizer;
                let elSizer = utils.createElement('div', { class: `rbroSizer rbroSizer${sizer}` });
                elSizer.addEventListener('mousedown', (event) => {
                    this.rb.getDocument().startDrag(event.pageX, event.pageY,
                        this.id, this.containerId, this.linkedContainerId,
                        this.getElementType(), DocElement.dragType['sizer' + sizerVal]);
                    event.stopPropagation();
                });
                elSizer.addEventListener('touchstart', (event) => {
                    if (this.rb.isSelectedObject(this.id)) {
                        let absPos = utils.getEventAbsPos(event);
                        this.rb.getDocument().startDrag(absPos.x, absPos.y,
                            this.id, this.containerId, this.linkedContainerId,
                            this.getElementType(), DocElement.dragType['sizer' + sizerVal]);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                });
                elSizer.addEventListener('touchmove', (event) => {
                    this.rb.getDocument().processDrag(event);
                });
                elSizer.addEventListener('touchend', (event) => {
                    this.rb.getDocument().stopDrag();
                });

                elSizerContainer.append(elSizer);
            }
            this.el.classList.add('rbroSelected');
            this.el.style.zIndex = '10';
        }
        this.selected = true;
    }

    deselect() {
        if (this.el !== null) {
            let elSizerContainer = this.getSizerContainerElement();
            const elSizers = elSizerContainer.querySelectorAll('.rbroSizer');
            for (const elSizer of elSizers) {
                elSizer.remove();
            }
            this.el.style.zIndex = '';
            this.el.classList.remove('rbroSelected');
        }
        this.selected = false;
    }

    /**
     * Returns allowed sizers when element is selected.
     * @returns {String[]}
     */
    getSizers() {
        return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    }

    hasBorderSettings() {
        return false;
    }

    /**
     * Returns true if the element can be selected when it is inside a
     * selection area (rectangle specified with pressed mouse button).
     */
    isAreaSelectionAllowed() {
        return true;
    }

    isDraggingAllowed() {
        return true;
    }

    /**
     * Returns true if another element can be dropped into this element (or its corresponding panel item).
     */
    isDroppingAllowed() {
        return true;
    }

    /**
     * Returns minimum allowed width of element.
     * @returns {Number}.
     */
    getMinWidth() {
        return 20;
    }

    /**
     * Returns maximum allowed width of element.
     * This is needed when the element is resized by dragging so the resized element does not overflow its container.
     * @returns {Number}.
     */
    getMaxWidth() {
        let containerSize = this.getContainerContentSize();
        return containerSize.width;
    }

    /**
     * Returns minimum allowed height of element.
     * @returns {Number}.
     */
    getMinHeight() {
        return 20;
    }

    createElement() {
    }

    getElement() {
        return this.el;
    }

    getSizerContainerElement() {
        return this.el;
    }

    /**
     * Returns dom node where elements will be added if they are inside this element.
     * Is null in case this element is not a container element like a frame or a band.
     * @returns {?Object} dom node
     */
    getContentElement() {
        return null;
    }

    /**
     * Returns true if this element has a data source setting.
     * This does not necessarily mean that a data source is available.
     * Must be overridden when the element has a data source.
     * @return {boolean}
     */
    hasDataSource() {
        return false;
    }

    /**
     * Returns the data source parameter name.
     * @returns {?String} contains the data source parameter name.
     * Is null in case element does not have a data source or the data source does not contain
     * a parameter reference.
     */
    getDataSourceParameterName() {
        if (this.hasDataSource()) {
            const dataSource = this.getValue('dataSource').trim();
            if (dataSource.length >= 3 && dataSource.substr(0, 2) === '${' &&
                    dataSource.charAt(dataSource.length - 1) === '}') {
                return dataSource.substring(2, dataSource.length - 1);
            }
        }
        return null;
    }

    /**
     * Returns all data sources of this element and any possible parent elements.
     * @returns {Object[]} array with all data sources where each item contains the name
     * of the data source parameter and all data source parameters.
     */
    getAllDataSources() {
        const dataSources = [];
        const dataSourceNames = [];
        this.getAllDataSourceParameterNames(dataSourceNames, null);
        // iterate data sources in reverse order -> start from root, the last data source will
        // be from this element. this way we can find data sources which are parameters
        // of a parent data source
        for (let i = dataSourceNames.length - 1; i >= 0; i--) {
            const dataSourceName = dataSourceNames[i];
            let param = null;
            // test if this data source is a parameter of a parent data source
            for (const parentDataSource of dataSources) {
                for (const dataSourceParameter of parentDataSource.parameters) {
                    if (dataSourceParameter.getName() === dataSourceName) {
                        param = dataSourceParameter;
                        break;
                    }
                }
            }
            if (param === null) {
                // root data source
                param = this.rb.getParameterByName(dataSourceName);
            }
            if (param !== null && param.getValue('type') === Parameter.type.array) {
                dataSources.unshift({ name: dataSourceName, parameters: param.getChildren() });
            }
        }
        return dataSources;
    }

    /**
     * Returns all data source parameter names of this element and any possible parent elements.
     * @param {String[]} dataSourceParameterNames - array where the data source names will be appended to.
     * @param {?DocElement} child - optional child element where the method was called from.
     */
    getAllDataSourceParameterNames(dataSourceParameterNames, child) {
        if (this.getElementType() === DocElement.type.table || this.getElementType() === DocElement.type.section) {
            if (child && child.getValue('bandType') === Band.bandType.content) {
                const dataSourceParameterName = this.getDataSourceParameterName();
                if (dataSourceParameterName !== null) {
                    dataSourceParameterNames.push(dataSourceParameterName);
                }
            }
        }
        let panelItem = this.getPanelItem();
        if (panelItem !== null) {
            let parentPanelItem = panelItem.getParent();
            if (parentPanelItem !== null && parentPanelItem.getData() instanceof DocElement) {
                parentPanelItem.getData().getAllDataSourceParameterNames(dataSourceParameterNames, this);
            }
        }
    }

    /**
     * Adds SetValue commands to command group parameter in case the specified parameter is used in any of
     * the object fields.
     * @param {Parameter} parameter - parameter which will be renamed.
     * @param {String} newParameterName - new name of the parameter.
     * @param {CommandGroupCmd} cmdGroup - possible SetValue commands will be added to this command group.
     */
    addCommandsForChangedParameterName(parameter, newParameterName, cmdGroup) {
    }

    /**
     * Adds SetValue command to command group parameter in case the specified parameter is used in the
     * specified object field.
     * @param {Parameter} parameter - parameter which will be renamed.
     * @param {String} newParameterName - new name of the parameter.
     * @param {String} field
     * @param {CommandGroupCmd} cmdGroup - possible SetValue command will be added to this command group.
     */
    addCommandForChangedParameterName(parameter, newParameterName, field, cmdGroup) {
        const paramParent = parameter.getParent();
        const dataSources = this.getAllDataSources();
        let paramRef = null;
        let newParamRef = null;

        if (paramParent !== null && paramParent.getValue('type') === Parameter.type.array) {
            for (const dataSource of dataSources) {
                if (dataSource.parameters.indexOf(parameter) !== -1) {
                    paramRef = '${' + parameter.getName() + '}';
                    newParamRef = '${' + newParameterName + '}';
                    break;
                }
            }
        } else {
            if (paramParent !== null && paramParent.getValue('type') === Parameter.type.map) {
                paramRef = '${' + paramParent.getName() + '.' + parameter.getName() + '}';
                newParamRef = '${' + paramParent.getName() + '.' + newParameterName + '}';
            } else if (parameter.getValue('type') === Parameter.type.map) {
                paramRef = '${' + parameter.getName() + '.';
                newParamRef = '${' + newParameterName + '.';
            } else {
                let isDataSourceParam = false;
                for (const dataSource of dataSources) {
                    for (const dataSourceParam of dataSource.parameters) {
                        if (dataSourceParam.getName() === parameter.getName()) {
                            // the changed parameter has the same name as a used data source parameter,
                            // therefor we are not going to change the parameter reference because it
                            // references the data source parameter
                            isDataSourceParam = true;
                            break;
                        }
                    }
                }
                if (!isDataSourceParam) {
                    paramRef = '${' + parameter.getName() + '}';
                    newParamRef = '${' + newParameterName + '}';
                }
            }
        }

        if (paramRef !== null && newParamRef !== null) {
            let value = this.getValue(field);
            let valueType = SetValueCmd.type.text;
            if (typeof value === 'object') {
                // for rich text we have to convert the rich text content to a string to replace all
                // parameter occurrences and afterwards convert it back to a JS object
                value = JSON.stringify(value);
                valueType = SetValueCmd.type.richText;
            }

            if (value.indexOf(paramRef) !== -1) {
                let updatedValue = utils.replaceAll(value, paramRef, newParamRef);
                if (valueType === SetValueCmd.type.richText) {
                    updatedValue = JSON.parse(updatedValue);
                }
                let cmd = new SetValueCmd(this.id, field, updatedValue, valueType, this.rb);
                cmdGroup.addCommand(cmd);
            }
        }
    }

    /**
     * Adds AddDeleteDocElementCmd commands to command group parameter to delete this element and
     * any possible existing children.
     * @param {CommandGroupCmd} cmdGroup - AddDeleteDocElementCmd commands will be added to this command group.
     */
    addCommandsForDelete(cmdGroup) {
        let elements = [];
        this.appendContainerChildren(elements);
        elements.push(this);
        for (let element of elements) {
            let cmd = new AddDeleteDocElementCmd(
                false, element.getPanelItem().getPanelName(),
                element.toJS(), element.getId(), element.getContainerId(),
                element.getPanelItem().getSiblingPosition(), this.rb);
            cmdGroup.addCommand(cmd);
        }
    }

    addCommandsForChangedWidth(newWidth, disableSelect, cmdGroup) {
        let cmd = new SetValueCmd(
            this.id, 'width', '' + newWidth, SetValueCmd.type.text, this.rb);
        if (disableSelect) {
            cmd.disableSelect();
        }
        cmdGroup.addCommand(cmd);
    }

    addChildren(docElements) {
    }

    addError(error) {
        this.errors.push(error);
    }

    clearErrors() {
        this.errors = [];
    }

    getErrors() {
        return this.errors;
    }

    remove() {
        if (this.el !== null) {
            this.el.remove();
            this.el = null;
        }
        if (this.panelItem !== null) {
            this.panelItem.getParent().removeChild(this.panelItem);
            this.panelItem = null;
        }
    }

    toJS() {
        let ret = { elementType: this.getElementType() };
        for (let field of this.getFields()) {
            if (['x', 'y', 'width', 'height'].indexOf(field) === -1) {
                ret[field] = this.getValue(field);
            } else {
                ret[field] = this.getValue(field + 'Val');
            }
        }
        return ret;
    }
}

DocElement.type = {
    none: 'none',
    text: 'text',
    image: 'image',
    line: 'line',
    table: 'table',
    pageBreak: 'page_break',
    tableText: 'table_text',
    barCode: 'bar_code',
    frame: 'frame',
    section: 'section'
};

DocElement.dragType = {
    none: -1,
    element: 0,
    sizerN: 1,
    sizerNE: 2,
    sizerE: 3,
    sizerSE: 4,
    sizerS: 5,
    sizerSW: 6,
    sizerW: 7,
    sizerNW: 8
};
